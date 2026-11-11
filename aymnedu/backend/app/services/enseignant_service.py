from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models import Utilisateur, RoleEnum
from app.core.security import hash_password
from app.schemas.enseignant import EnseignantCreate


def list_enseignants(db: Session, centre_id: int) -> list[Utilisateur]:
    return db.query(Utilisateur).filter(
        Utilisateur.centre_id == centre_id,
        Utilisateur.role == RoleEnum.enseignant
    ).all()


def create_enseignant(db: Session, centre_id: int, data: EnseignantCreate) -> Utilisateur:
    existing = db.query(Utilisateur).filter(Utilisateur.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")

    enseignant = Utilisateur(
        full_name=data.full_name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=RoleEnum.enseignant,
        centre_id=centre_id,
    )
    db.add(enseignant)
    db.commit()
    db.refresh(enseignant)
    return enseignant


def delete_enseignant(db: Session, centre_id: int, enseignant_id: int) -> None:
    enseignant = db.query(Utilisateur).filter(
        Utilisateur.id == enseignant_id,
        Utilisateur.centre_id == centre_id,
        Utilisateur.role == RoleEnum.enseignant
    ).first()
    if not enseignant:
        raise HTTPException(status_code=404, detail="Enseignant non trouvé")
    db.delete(enseignant)
    db.commit()
