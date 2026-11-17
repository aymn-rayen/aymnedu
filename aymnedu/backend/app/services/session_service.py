import logging
from datetime import datetime, timezone
from fastapi import HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from typing import Optional

from app.models import Utilisateur, RefreshToken
from app.core.security import (
    create_access_token,
    create_refresh_token_payload,
    decode_token,
    hash_token,
)
from app.core.config import settings

logger = logging.getLogger("aymnedu.security")

COOKIE_REFRESH_NAME = "refresh_token"


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Sets a secure, HttpOnly, SameSite cookie for the refresh token."""
    response.set_cookie(
        key=COOKIE_REFRESH_NAME,
        value=refresh_token,
        httponly=True,
        secure=not settings.DEBUG,  # True in production
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        path="/api/v1/auth",
    )


def clear_refresh_cookie(response: Response) -> None:
    """Removes the refresh token cookie."""
    response.delete_cookie(
        key=COOKIE_REFRESH_NAME,
        path="/api/v1/auth",
    )


def issue_tokens(
    db: Session,
    user: Utilisateur,
    request: Optional[Request] = None,
    response: Optional[Response] = None,
    family_id: Optional[str] = None,
) -> dict:
    """
    Issues a new access token and a tracked refresh token.
    Saves the hashed refresh token into the database with a unique jti and family_id.
    """
    user_data = {"sub": str(user.id), "centre_id": user.centre_id}
    access_token = create_access_token(user_data)
    raw_refresh, jti, token_family, expires_at = create_refresh_token_payload(user_data, family_id=family_id)

    # Extract client metadata if request is available
    user_agent = request.headers.get("user-agent")[:255] if request and request.headers.get("user-agent") else None
    ip_address = request.client.host if request and request.client else None

    # Save to database
    db_token = RefreshToken(
        user_id=user.id,
        jti=jti,
        family_id=token_family,
        token_hash=hash_token(raw_refresh),
        expires_at=expires_at.replace(tzinfo=None) if expires_at.tzinfo else expires_at,
        revoked_at=None,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    db.add(db_token)
    db.commit()

    if response:
        set_refresh_cookie(response, raw_refresh)

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh,
        "token_type": "bearer",
    }


def rotate_refresh_token(
    db: Session,
    raw_refresh_token: str,
    request: Optional[Request] = None,
    response: Optional[Response] = None,
) -> dict:
    """
    Performs RFC 6749 Refresh Token Rotation (RTR).
    - If token is valid & active: revokes it and issues a new pair in the same family.
    - If token was ALREADY revoked: REUSE DETECTED! Revokes all tokens in the family.
    """
    payload = decode_token(raw_refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalide ou expiré"
        )

    user_id_str = payload.get("sub")
    jti = payload.get("jti")
    family_id = payload.get("family")

    if not user_id_str or not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Payload de jeton corrompu"
        )

    user = db.query(Utilisateur).filter(Utilisateur.id == int(user_id_str)).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur inactif ou introuvable"
        )

    # Find the token by jti or hash
    db_token = db.query(RefreshToken).filter(RefreshToken.jti == jti).first()
    if not db_token:
        # Fallback check by hash
        t_hash = hash_token(raw_refresh_token)
        db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == t_hash).first()

    now = datetime.now()

    # CASE A: Token is NOT found in database
    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session non reconnue ou révoquée"
        )

    # CASE B: REUSE DETECTED (The token was already revoked!)
    if db_token.revoked_at is not None:
        logger.warning(
            f"SECURITY ALERT: Refresh token reuse detected for user {user.id} "
            f"(jti={jti}, family={db_token.family_id}). Revoking entire family."
        )
        # Invalidate ALL tokens in this family to protect the user from session hijacking
        db.query(RefreshToken).filter(
            RefreshToken.family_id == db_token.family_id,
            RefreshToken.revoked_at == None  # noqa: E711
        ).update({"revoked_at": now})
        db.commit()

        if response:
            clear_refresh_cookie(response)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tentative de réutilisation détectée. Session invalidée par sécurité. Veuillez vous reconnecter."
        )

    # Check expiration
    token_exp = db_token.expires_at.replace(tzinfo=None) if db_token.expires_at.tzinfo else db_token.expires_at
    if token_exp < now:
        db_token.revoked_at = now
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expirée, veuillez vous reconnecter"
        )

    # CASE C: Token is active -> Revoke it (Single-use RTR)
    db_token.revoked_at = now
    db.commit()

    # Issue new pair in the same family lineage
    return issue_tokens(
        db=db,
        user=user,
        request=request,
        response=response,
        family_id=db_token.family_id,
    )


def revoke_token(
    db: Session,
    raw_refresh_token: Optional[str] = None,
    user_id: Optional[int] = None,
    response: Optional[Response] = None,
) -> None:
    """Revokes a specific session upon user logout."""
    now = datetime.now()

    if raw_refresh_token:
        payload = decode_token(raw_refresh_token)
        jti = payload.get("jti") if payload else None
        if jti:
            db.query(RefreshToken).filter(
                RefreshToken.jti == jti,
                RefreshToken.revoked_at == None  # noqa: E711
            ).update({"revoked_at": now})
        else:
            t_hash = hash_token(raw_refresh_token)
            db.query(RefreshToken).filter(
                RefreshToken.token_hash == t_hash,
                RefreshToken.revoked_at == None  # noqa: E711
            ).update({"revoked_at": now})
    elif user_id:
        # Revoke the latest active token for this user
        db.query(RefreshToken).filter(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at == None  # noqa: E711
        ).update({"revoked_at": now})

    db.commit()

    if response:
        clear_refresh_cookie(response)


def revoke_all_sessions(db: Session, user_id: int) -> int:
    """Revokes ALL active sessions for a user (e.g. lost device, password change)."""
    now = datetime.now()
    count = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at == None  # noqa: E711
    ).update({"revoked_at": now})
    db.commit()
    return count

