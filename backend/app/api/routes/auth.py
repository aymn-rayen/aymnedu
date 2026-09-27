from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import (
    verify_password, hash_password, create_access_token, create_refresh_token, decode_token
)
from app.models import Utilisateur, Centre, RoleEnum

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ── Schemas ───────────────────────────────────────────────────────
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    centre_id: int
    is_active: bool
    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    nom_centre: str
    wilaya: str | None = None
    telephone: str | None = None
    full_name: str
    email: str
    password: str


# ── Dependency: get current user ──────────────────────────────────
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Utilisateur:
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide ou expiré")
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide ou expiré")
    try:
        user_id = int(sub)
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")

    user = db.query(Utilisateur).filter(Utilisateur.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur non trouvé")
    return user


def require_role(*roles: str):
    def dependency(current_user: Utilisateur = Depends(get_current_user)):
        if current_user.role.value not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
        return current_user
    return dependency


# ── Endpoints ─────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Utilisateur).filter(Utilisateur.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants incorrects")
    data = {"sub": str(user.id), "centre_id": user.centre_id}
    return TokenResponse(
        access_token=create_access_token(data),
        refresh_token=create_refresh_token(data),
    )


@router.post("/register", response_model=TokenResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    # Vérifier l'email
    existing_user = db.query(Utilisateur).filter(Utilisateur.email == body.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un utilisateur avec cet email existe déjà"
        )
    
    try:
        # Créer le centre
        centre = Centre(
            nom=body.nom_centre,
            wilaya=body.wilaya,
            telephone=body.telephone,
            subscription_plan="starter",
            is_active=True
        )
        db.add(centre)
        db.flush()
        
        # Créer le directeur
        director = Utilisateur(
            centre_id=centre.id,
            email=body.email,
            hashed_password=hash_password(body.password),
            full_name=body.full_name,
            role=RoleEnum.directeur,
            is_active=True
        )
        db.add(director)
        db.commit()
        db.refresh(director)
        
        data = {"sub": str(director.id), "centre_id": director.centre_id}
        return TokenResponse(
            access_token=create_access_token(data),
            refresh_token=create_refresh_token(data),
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur durant l'inscription : {str(e)}"
        )


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalide")
    user = db.query(Utilisateur).filter(Utilisateur.id == int(payload["sub"])).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur non trouvé")
    data = {"sub": str(user.id), "centre_id": user.centre_id}
    return TokenResponse(
        access_token=create_access_token(data),
        refresh_token=create_refresh_token(data),
    )


@router.get("/me", response_model=UserOut)
def me(current_user: Utilisateur = Depends(get_current_user)):
    return current_user


# ── Role-based login (used by the new login page) ──────────────────────────

class LoginRoleRequest(BaseModel):
    """
    Connexion par rôle.
    L'utilisateur sélectionne son école (centre_id), son rôle et entre son mot de passe.
    """
    centre_id: int
    role: str       # "directeur" | "secretaire" | "enseignant"
    password: str


class CentreSearchResult(BaseModel):
    id: int
    nom: str
    wilaya: str | None = None

    class Config:
        from_attributes = True


class RoleUserInfo(BaseModel):
    id: int
    full_name: str
    role: str

    class Config:
        from_attributes = True


@router.get("/centres/search", response_model=list[CentreSearchResult])
def search_centres(q: str = "", db: Session = Depends(get_db)):
    """
    Cherche des centres (écoles) par nom — utilisé dans la page de login
    pour que l'utilisateur trouve son école rapidement.
    """
    from app.models import Centre
    query = db.query(Centre).filter(Centre.is_active == True)  # noqa: E712
    if q.strip():
        query = query.filter(Centre.nom.ilike(f"%{q}%"))
    return query.order_by(Centre.nom).limit(20).all()


@router.get("/centres/{centre_id}/roles", response_model=list[RoleUserInfo])
def list_roles_for_centre(centre_id: int, db: Session = Depends(get_db)):
    """
    Retourne la liste des utilisateurs actifs d'un centre, groupés par rôle.
    Utilisé dans la page de login pour afficher le dropdown des profils disponibles.
    """
    users = db.query(Utilisateur).filter(
        Utilisateur.centre_id == centre_id,
        Utilisateur.is_active == True,  # noqa: E712
    ).order_by(Utilisateur.role, Utilisateur.full_name).all()
    return users


@router.post("/login-role", response_model=TokenResponse)
def login_by_role(body: LoginRoleRequest, db: Session = Depends(get_db)):
    """
    Connexion par sélection de rôle :
    1. L'utilisateur choisit son école (centre_id)
    2. Sélectionne son rôle/profil
    3. Saisit son mot de passe
    """
    # Trouver tous les utilisateurs du centre avec ce rôle
    valid_roles = {r.value for r in RoleEnum}
    if body.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rôle invalide : {body.role}"
        )

    users = db.query(Utilisateur).filter(
        Utilisateur.centre_id == body.centre_id,
        Utilisateur.role == RoleEnum(body.role),
        Utilisateur.is_active == True,  # noqa: E712
    ).all()

    if not users:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Aucun compte actif avec ce rôle dans cette école"
        )

    # Vérifier le mot de passe parmi les utilisateurs du rôle
    authenticated_user = None
    for user in users:
        if verify_password(body.password, user.hashed_password):
            authenticated_user = user
            break

    if not authenticated_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mot de passe incorrect"
        )

    data = {"sub": str(authenticated_user.id), "centre_id": authenticated_user.centre_id}
    return TokenResponse(
        access_token=create_access_token(data),
        refresh_token=create_refresh_token(data),
    )
