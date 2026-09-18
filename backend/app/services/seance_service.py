from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from fastapi import HTTPException
from datetime import time as time_type

from app.models import Seance, Groupe, Utilisateur, RoleEnum
from app.schemas.seance import SeanceCreate, SeanceUpdate, SeanceOut


def parse_time_str(val):
    if isinstance(val, str):
        parts = val.split(":")
        return time_type(int(parts[0]), int(parts[1]))
    return val


def _check_collisions(
    db: Session,
    centre_id: int,
    jour_semaine: str,
    heure_debut: time_type,
    heure_fin: time_type,
    salle: str | None,
    enseignant_id: int | None,
    exclude_id: int | None = None,
) -> None:
    """
    Vérifie les conflits de salle et d'enseignant pour une séance donnée.

    Deux séances se chevauchent si :
        heure_debut_A < heure_fin_B  AND  heure_fin_A > heure_debut_B

    Lève HTTPException 409 si un conflit est détecté.
    """
    # Requête de base : même centre, même jour, chevauchement d'horaire
    overlap_filter = and_(
        Seance.centre_id == centre_id,
        Seance.jour_semaine == jour_semaine,
        Seance.heure_debut < heure_fin,
        Seance.heure_fin > heure_debut,
    )

    # Exclure la séance elle-même lors d'un update
    if exclude_id is not None:
        overlap_filter = and_(overlap_filter, Seance.id != exclude_id)

    # ── Conflit de salle ──────────────────────────────────────────────────────
    if salle:
        conflit_salle = db.query(Seance).filter(
            overlap_filter,
            Seance.salle == salle,
        ).first()
        if conflit_salle:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Conflit de salle : la salle « {salle} » est déjà occupée "
                    f"le {jour_semaine} de {conflit_salle.heure_debut} à {conflit_salle.heure_fin}."
                ),
            )

    # ── Conflit d'enseignant ──────────────────────────────────────────────────
    if enseignant_id:
        conflit_ens = db.query(Seance).filter(
            overlap_filter,
            Seance.enseignant_id == enseignant_id,
        ).first()
        if conflit_ens:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Conflit d'enseignant : cet enseignant a déjà une séance "
                    f"le {jour_semaine} de {conflit_ens.heure_debut} à {conflit_ens.heure_fin}."
                ),
            )


def _build_seance_out(s: Seance) -> SeanceOut:
    """Construit SeanceOut avec les champs dénormalisés."""
    out = SeanceOut.model_validate(s)
    out.groupe_nom = s.groupe.nom if s.groupe else None
    out.heure_debut = str(s.heure_debut)
    out.heure_fin = str(s.heure_fin)
    out.enseignant_nom = s.enseignant.full_name if s.enseignant else None
    return out


def list_seances(db: Session, centre_id: int) -> list[SeanceOut]:
    seances = db.query(Seance).filter(Seance.centre_id == centre_id).all()
    return [_build_seance_out(s) for s in seances]


def create_seance(db: Session, centre_id: int, data: SeanceCreate) -> SeanceOut:
    groupe = db.query(Groupe).filter(Groupe.id == data.groupe_id, Groupe.centre_id == centre_id).first()
    if not groupe:
        raise HTTPException(status_code=404, detail="Groupe non trouvé")

    if data.enseignant_id:
        ens = db.query(Utilisateur).filter(
            Utilisateur.id == data.enseignant_id,
            Utilisateur.centre_id == centre_id,
            Utilisateur.role == RoleEnum.enseignant
        ).first()
        if not ens:
            raise HTTPException(status_code=400, detail="Enseignant non trouvé dans ce centre")

    raw_data = data.model_dump()
    heure_debut = parse_time_str(raw_data["heure_debut"])
    heure_fin = parse_time_str(raw_data["heure_fin"])

    if heure_debut >= heure_fin:
        raise HTTPException(status_code=400, detail="heure_debut doit être antérieure à heure_fin")

    # ── Vérification des collisions avant insertion ───────────────────────────
    _check_collisions(
        db=db,
        centre_id=centre_id,
        jour_semaine=raw_data["jour_semaine"],
        heure_debut=heure_debut,
        heure_fin=heure_fin,
        salle=raw_data.get("salle"),
        enseignant_id=raw_data.get("enseignant_id"),
    )

    raw_data["heure_debut"] = heure_debut
    raw_data["heure_fin"] = heure_fin
    seance = Seance(**raw_data, centre_id=centre_id)
    db.add(seance)
    db.commit()
    db.refresh(seance)
    return _build_seance_out(seance)


def update_seance(db: Session, centre_id: int, seance_id: int, data: SeanceUpdate) -> SeanceOut:
    s = db.query(Seance).filter(Seance.id == seance_id, Seance.centre_id == centre_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Séance non trouvée")

    update_data = data.model_dump(exclude_unset=True)

    if "groupe_id" in update_data and update_data["groupe_id"] is not None:
        groupe = db.query(Groupe).filter(Groupe.id == update_data["groupe_id"], Groupe.centre_id == centre_id).first()
        if not groupe:
            raise HTTPException(status_code=404, detail="Groupe non trouvé")

    if "enseignant_id" in update_data and update_data["enseignant_id"] is not None:
        ens = db.query(Utilisateur).filter(
            Utilisateur.id == update_data["enseignant_id"],
            Utilisateur.centre_id == centre_id,
            Utilisateur.role == RoleEnum.enseignant
        ).first()
        if not ens:
            raise HTTPException(status_code=400, detail="Enseignant non trouvé dans ce centre")

    # Résoudre les valeurs finales (après merge avec l'existant)
    final_jour = update_data.get("jour_semaine", s.jour_semaine)
    final_debut = parse_time_str(update_data.get("heure_debut", s.heure_debut))
    final_fin = parse_time_str(update_data.get("heure_fin", s.heure_fin))
    final_salle = update_data.get("salle", s.salle)
    final_ens_id = update_data.get("enseignant_id", s.enseignant_id)

    if final_debut >= final_fin:
        raise HTTPException(status_code=400, detail="heure_debut doit être antérieure à heure_fin")

    # ── Vérification des collisions en excluant la séance courante ────────────
    _check_collisions(
        db=db,
        centre_id=centre_id,
        jour_semaine=final_jour,
        heure_debut=final_debut,
        heure_fin=final_fin,
        salle=final_salle,
        enseignant_id=final_ens_id,
        exclude_id=seance_id,
    )

    for field, val in update_data.items():
        if val is not None:
            if field in ("heure_debut", "heure_fin"):
                val = parse_time_str(val)
            setattr(s, field, val)

    db.commit()
    db.refresh(s)
    return _build_seance_out(s)


def delete_seance(db: Session, centre_id: int, seance_id: int) -> None:
    s = db.query(Seance).filter(Seance.id == seance_id, Seance.centre_id == centre_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Séance non trouvée")
    db.delete(s)
    db.commit()
