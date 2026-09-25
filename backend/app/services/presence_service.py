from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import date as date_type

from app.models import Presence, Groupe, Eleve, InscriptionGroupe
from app.schemas.presence import PresenceIn


def list_presences(db: Session, centre_id: int, groupe_id: int, date: date_type):
    groupe = db.query(Groupe).filter(Groupe.id == groupe_id, Groupe.centre_id == centre_id).first()
    if not groupe:
        raise HTTPException(status_code=404, detail="Groupe non trouvé")

    # Récupérer tous les élèves inscrits dans le groupe
    inscriptions = (
        db.query(InscriptionGroupe)
        .join(Eleve, InscriptionGroupe.eleve_id == Eleve.id)
        .filter(
            InscriptionGroupe.groupe_id == groupe_id,
            Eleve.centre_id == centre_id,
            Eleve.deleted_at == None,
            Eleve.statut == "actif",
        )
        .all()
    )

    # Présences déjà existantes pour ce créneau
    existing = {
        p.eleve_id: p
        for p in db.query(Presence).filter(
            Presence.groupe_id == groupe_id,
            Presence.date_seance == date,
        ).all()
    }

    result = []
    for insc in inscriptions:
        eleve = insc.eleve
        if not eleve:
            continue
        p = existing.get(eleve.id)
        if p:
            statut_val = p.statut.value if hasattr(p.statut, "value") else str(p.statut)
            result.append({
                "id": p.id,
                "eleve_id": eleve.id,
                "groupe_id": groupe_id,
                "date_seance": date,
                "statut": statut_val,
                "minutes_retard": p.minutes_retard,
                "eleve_nom": f"{eleve.prenom} {eleve.nom}",
            })
        else:
            result.append({
                "id": None,
                "eleve_id": eleve.id,
                "groupe_id": groupe_id,
                "date_seance": date,
                "statut": "present",
                "minutes_retard": 0,
                "eleve_nom": f"{eleve.prenom} {eleve.nom}",
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
