"""
Route pour la gestion des utilisateurs du centre (CRUD).
Seul le directeur peut accéder à ces endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import hash_password
from app.api.routes.auth import require_role
from app.models import Utilisateur, RoleEnum

router = APIRouter(prefix="/utilisateurs", tags=["utilisateurs"])

ROLE_DIR = RoleEnum.directeur.value


# ── Schemas ──────────────────────────────────────────────────────────────────
class UtilisateurOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class CreateUtilisateurRequest(BaseModel):
    full_name: str
    email: str
    password: str
    role: str  # "secretaire" | "enseignant" | "directeur"


class UpdatePasswordRequest(BaseModel):
    password: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[UtilisateurOut])
def list_utilisateurs(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_role(ROLE_DIR)),
):
    """Liste tous les utilisateurs du centre (directeurs, secrétaires, enseignants)."""
    users = db.query(Utilisateur).filter(
        Utilisateur.centre_id == current_user.centre_id,
        Utilisateur.is_active == True,  # noqa: E712
    ).order_by(Utilisateur.role, Utilisateur.full_name).all()
    return users


@router.post("", response_model=UtilisateurOut, status_code=201)
def create_utilisateur(
    body: CreateUtilisateurRequest,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_role(ROLE_DIR)),
):
    """Crée un nouvel utilisateur dans le centre (secrétaire, enseignant, etc.)."""
    # Vérifier le rôle
    valid_roles = {r.value for r in RoleEnum}
    if body.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rôle invalide. Valeurs acceptées : {', '.join(valid_roles)}"
        )

    # Email unique dans tout le système
    existing = db.query(Utilisateur).filter(Utilisateur.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un utilisateur avec cet email existe déjà"
        )

    user = Utilisateur(
        centre_id=current_user.centre_id,
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=RoleEnum(body.role),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/password", response_model=UtilisateurOut)
def reset_password(
    user_id: int,
    body: UpdatePasswordRequest,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_role(ROLE_DIR)),
):
    """Réinitialise le mot de passe d'un utilisateur du centre."""
    user = db.query(Utilisateur).filter(
        Utilisateur.id == user_id,
        Utilisateur.centre_id == current_user.centre_id,
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    if len(body.password) < 4:
        raise HTTPException(status_code=400, detail="Le mot de passe doit faire au moins 4 caractères")

    user.hashed_password = hash_password(body.password)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_utilisateur(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(require_role(ROLE_DIR)),
):
    """Désactive un utilisateur du centre (soft delete)."""
    user = db.query(Utilisateur).filter(
        Utilisateur.id == user_id,
        Utilisateur.centre_id == current_user.centre_id,
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    # On ne peut pas supprimer sa propre session
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte")

    user.is_active = False
    db.commit()
