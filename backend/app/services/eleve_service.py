from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException
from typing import Optional

from app.models import Eleve
from app.schemas.eleve import EleveCreate, EleveUpdate


def list_eleves(
    db: Session,
    centre_id: int,
    q: Optional[str] = None,
    page: int = 1,
    size: int = 25
):
    # Filtre les élèves non supprimés (deleted_at IS NULL)
    query = db.query(Eleve).filter(
        Eleve.centre_id == centre_id,
        Eleve.deleted_at == None  # noqa: E711
    )
    if q:
        like = f"%{q}%"
        query = query.filter((Eleve.prenom.ilike(like)) | (Eleve.nom.ilike(like)))
    total = query.count()
    items = query.offset((page - 1) * size).limit(size).all()
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": -(-total // size)
    }


def get_eleve(db: Session, centre_id: int, eleve_id: int) -> Eleve:
    """Récupère un élève actif (non supprimé). Lève 404 si soft-deleted."""
    eleve = db.query(Eleve).filter(
        Eleve.id == eleve_id,
        Eleve.centre_id == centre_id,
        Eleve.deleted_at == None  # noqa: E711
    ).first()
    if not eleve:
        raise HTTPException(status_code=404, detail="Élève non trouvé")
    return eleve


def create_eleve(db: Session, centre_id: int, data: EleveCreate) -> Eleve:
    eleve = Eleve(**data.model_dump(), centre_id=centre_id)
    db.add(eleve)
    db.commit()
    db.refresh(eleve)
    return eleve


def update_eleve(db: Session, centre_id: int, eleve_id: int, data: EleveUpdate) -> Eleve:
    eleve = get_eleve(db, centre_id, eleve_id)
    update_data = data.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None:
            setattr(eleve, field, val)
    db.commit()
    db.refresh(eleve)
    return eleve


def delete_eleve(db: Session, centre_id: int, eleve_id: int) -> None:
    """Soft delete — positionne deleted_at au timestamp actuel."""
    eleve = get_eleve(db, centre_id, eleve_id)
    eleve.deleted_at = func.now()
    db.commit()
