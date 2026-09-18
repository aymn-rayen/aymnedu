from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import date as date_type

from app.models import Presence, Groupe, Eleve
from app.schemas.presence import PresenceIn


def list_presences(db: Session, centre_id: int, groupe_id: int, date: date_type):
    groupe = db.query(Groupe).filter(Groupe.id == groupe_id, Groupe.centre_id == centre_id).first()
    if not groupe:
        raise HTTPException(status_code=404, detail="Groupe non trouvé")

    rows = db.query(Presence).filter(Presence.groupe_id == groupe_id, Presence.date_seance == date).all()
    result = []
    for r in rows:
        result.append({
            **r.__dict__,
            "eleve_nom": f"{r.eleve.prenom} {r.eleve.nom}" if r.eleve else None
        })
    return result


def save_presences_batch(db: Session, centre_id: int, items: list[PresenceIn]) -> None:
    for item in items:
        eleve = db.query(Eleve).filter(Eleve.id == item.eleve_id, Eleve.centre_id == centre_id).first()
        if not eleve:
            continue

        existing = db.query(Presence).filter(
            Presence.eleve_id == item.eleve_id,
            Presence.groupe_id == item.groupe_id,
            Presence.date_seance == item.date_seance,
        ).first()

        if existing:
            existing.statut = item.statut  # type: ignore
            existing.minutes_retard = item.minutes_retard
        else:
            db.add(Presence(**item.model_dump()))

    db.commit()
