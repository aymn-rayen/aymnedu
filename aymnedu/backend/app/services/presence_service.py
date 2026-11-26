from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException
from datetime import date as date_type

from app.models import Presence, Groupe, Eleve, InscriptionGroupe, Seance
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

    from app.services.subscription_service import assert_subscription_active
    assert_subscription_active(db, centre_id)

    eleve_ids = list({item.eleve_id for item in items})
    valid_eleve_rows = db.query(Eleve.id).filter(
        Eleve.id.in_(eleve_ids),
        Eleve.centre_id == centre_id,
    ).all()
    valid_eleves = {row[0] for row in valid_eleve_rows}

    # Charger toutes les présences existantes en 1 seule requête
    groupe_ids = list({item.groupe_id for item in items})
    valid_groupe_rows = db.query(Groupe.id).filter(
        Groupe.id.in_(groupe_ids),
        Groupe.centre_id == centre_id,
        Groupe.deleted_at == None,  # noqa: E711
    ).all()
    valid_groupes = {row[0] for row in valid_groupe_rows}

    dates = list({item.date_seance for item in items})

    existing_presences = db.query(Presence).filter(
        Presence.groupe_id.in_(list(valid_groupes)),
        Presence.date_seance.in_(dates),
        Presence.eleve_id.in_(list(valid_eleves)),
    ).all()

    existing_map = {(p.groupe_id, p.date_seance, p.eleve_id): p for p in existing_presences}

    for item in items:
        if item.eleve_id not in valid_eleves or item.groupe_id not in valid_groupes:
            continue

        key = (item.groupe_id, item.date_seance, item.eleve_id)
        if key in existing_map:
            existing = existing_map[key]
            existing.statut = item.statut  # type: ignore
            existing.minutes_retard = item.minutes_retard
        else:
            db.add(Presence(**item.model_dump()))

    db.commit()


def get_grille_mensuelle(db: Session, centre_id: int, groupe_id: int, mois: str):
    """
    Retourne la grille mensuelle complète de présence pour un groupe et un mois (YYYY-MM).
    """
    import calendar
    import re

    if not re.match(r"^\d{4}-(0[1-9]|1[0-2])$", mois):
        raise HTTPException(status_code=400, detail="Format de mois invalide. Format attendu : YYYY-MM (ex: 2026-11)")

    year, month = map(int, mois.split("-"))
    _, num_days = calendar.monthrange(year, month)
    start_date = date_type(year, month, 1)
    end_date = date_type(year, month, num_days)

    groupe = db.query(Groupe).filter(
        Groupe.id == groupe_id,
        Groupe.centre_id == centre_id,
        Groupe.deleted_at == None,  # noqa: E711
    ).first()
    if not groupe:
        raise HTTPException(status_code=404, detail="Groupe non trouvé")

    # Élèves inscrits actifs
    inscriptions = (
        db.query(InscriptionGroupe)
        .options(joinedload(InscriptionGroupe.eleve))
        .join(Eleve, InscriptionGroupe.eleve_id == Eleve.id)
        .filter(
            InscriptionGroupe.groupe_id == groupe_id,
            Eleve.centre_id == centre_id,
            Eleve.deleted_at == None,  # noqa: E711
            Eleve.statut == "actif",
        )
        .order_by(Eleve.nom.asc(), Eleve.prenom.asc())
        .all()
    )

    # 1. Dates réelles ayant déjà fait l'objet d'un pointage ce mois-ci
    presence_dates_rows = (
        db.query(Presence.date_seance)
        .filter(
            Presence.groupe_id == groupe_id,
            Presence.date_seance >= start_date,
            Presence.date_seance <= end_date,
        )
        .distinct()
        .all()
    )
    presence_dates = {row[0] for row in presence_dates_rows}

    # 2. Dates calculées selon l'emploi du temps (Seances) du groupe
    seances = db.query(Seance).filter(
        Seance.groupe_id == groupe_id,
        Seance.centre_id == centre_id,
    ).all()
    JOURS_MAP = {
        "lundi": 0, "mardi": 1, "mercredi": 2, "jeudi": 3,
        "vendredi": 4, "samedi": 5, "dimanche": 6,
    }
    scheduled_weekdays = {
        JOURS_MAP[s.jour_semaine.lower()]
        for s in seances
        if s.jour_semaine and s.jour_semaine.lower() in JOURS_MAP
    }

    scheduled_dates = set()
    if scheduled_weekdays:
        for day in range(1, num_days + 1):
            d = date_type(year, month, day)
            if d.weekday() in scheduled_weekdays:
                scheduled_dates.add(d)

    all_dates = sorted(list(presence_dates.union(scheduled_dates)))

    # 3. Charger toutes les présences pour ce mois
    presences_rows = (
        db.query(Presence)
        .filter(
            Presence.groupe_id == groupe_id,
            Presence.date_seance >= start_date,
            Presence.date_seance <= end_date,
        )
        .all()
    )
    pres_map = {(p.eleve_id, p.date_seance): p for p in presences_rows}

    eleves_data = []
    for insc in inscriptions:
        eleve = insc.eleve
        if not eleve:
            continue
        seances_dict = {}
        presents = 0
        absents = 0
        retards = 0

        for d in all_dates:
            d_str = str(d)
            p = pres_map.get((eleve.id, d))
            if p:
                statut_val = p.statut.value if hasattr(p.statut, "value") else str(p.statut)
                seances_dict[d_str] = statut_val
                if statut_val == "present":
                    presents += 1
                elif statut_val == "absent":
                    absents += 1
                elif statut_val == "retard":
                    retards += 1
            else:
                seances_dict[d_str] = None

        total_pointes = presents + absents + retards
        taux = round((presents / total_pointes * 100), 1) if total_pointes > 0 else 100.0

        eleves_data.append({
            "eleve_id": eleve.id,
            "eleve_nom": f"{eleve.nom} {eleve.prenom}",
            "matricule": eleve.matricule or f"ELV-{eleve.id:04d}",
            "telephone": eleve.telephone_responsable,
            "seances": seances_dict,
            "nb_presents": presents,
            "nb_absents": absents,
            "nb_retards": retards,
            "taux_presence": taux,
        })

    return {
        "groupe_id": groupe.id,
        "groupe_nom": groupe.nom,
        "matiere": groupe.matiere,
        "niveau": groupe.niveau,
        "mois": mois,
        "dates": [str(d) for d in all_dates],
        "eleves": eleves_data,
        "total_eleves": len(eleves_data),
    }
