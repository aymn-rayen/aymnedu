from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException
from datetime import date as date_type

from app.models import Presence, Groupe, Eleve, InscriptionGroupe
from app.schemas.presence import PresenceIn


def list_presences(db: Session, centre_id: int, groupe_id: int, date: date_type):
    groupe = db.query(Groupe).filter(Groupe.id == groupe_id, Groupe.centre_id == centre_id).first()
    if not groupe:
        raise HTTPException(status_code=404, detail="Groupe non trouvé")

    # Récupérer tous les élèves inscrits dans le groupe avec eleve eager-loaded (pas de N+1)
    inscriptions = (
        db.query(InscriptionGroupe)
        .options(joinedload(InscriptionGroupe.eleve))
        .join(Eleve, InscriptionGroupe.eleve_id == Eleve.id)
        .filter(
            InscriptionGroupe.groupe_id == groupe_id,
            Eleve.centre_id == centre_id,
            Eleve.deleted_at == None,
            Eleve.statut == "actif",
        )
        .order_by(Eleve.nom.asc(), Eleve.prenom.asc())
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
    """Enregistre en batch les présences en 2 requêtes au lieu de 2*N requêtes."""
    if not items:
        return

    eleve_ids = list({item.eleve_id for item in items})
    valid_eleve_rows = db.query(Eleve.id).filter(
        Eleve.id.in_(eleve_ids),
        Eleve.centre_id == centre_id,
    ).all()
    valid_eleves = {row[0] for row in valid_eleve_rows}

    # Charger toutes les présences existantes en 1 seule requête
    groupe_ids = list({item.groupe_id for item in items})
    dates = list({item.date_seance for item in items})

    existing_presences = db.query(Presence).filter(
        Presence.groupe_id.in_(groupe_ids),
        Presence.date_seance.in_(dates),
        Presence.eleve_id.in_(list(valid_eleves)),
    ).all()

    existing_map = {(p.groupe_id, p.date_seance, p.eleve_id): p for p in existing_presences}

    for item in items:
        if item.eleve_id not in valid_eleves:
            continue

        key = (item.groupe_id, item.date_seance, item.eleve_id)
        if key in existing_map:
            existing = existing_map[key]
            existing.statut = item.statut  # type: ignore
            existing.minutes_retard = item.minutes_retard
        else:
            db.add(Presence(**item.model_dump()))

    db.commit()
