import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from jose import jwt, JWTError
import bcrypt
from app.core.config import settings

# ── Password Utilities ──────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    plain_bytes = plain.encode('utf-8')
    hashed_bytes = hashed.encode('utf-8')
    try:
        return bcrypt.checkpw(plain_bytes, hashed_bytes)
    except Exception:
        return False


# ── Token Hash & JWT Utilities ──────────────────────────────────────────────

def hash_token(token: str) -> str:
    """Calculates SHA-256 hash of a raw token for secure database storage."""
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def create_access_token(data: dict[str, Any]) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload["type"] = "access"
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token_payload(
    data: dict[str, Any],
    jti: str | None = None,
    family_id: str | None = None
) -> tuple[str, str, str, datetime]:
    """
    Creates a cryptographically signed refresh token with unique jti and session family.
    Returns: (raw_token, jti, family_id, expires_at)
    """
    payload = data.copy()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    token_jti = jti or str(uuid.uuid4())
    token_family = family_id or str(uuid.uuid4())
    payload["exp"] = expires_at
    payload["type"] = "refresh"
    payload["jti"] = token_jti
    payload["family"] = token_family
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token, token_jti, token_family, expires_at


def create_refresh_token(data: dict[str, Any]) -> str:
    token, _, _, _ = create_refresh_token_payload(data)
    return token


def decode_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
