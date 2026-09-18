from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException

from app.models import Groupe, InscriptionGroupe, Utilisateur, RoleEnum, Eleve
from app.schemas.groupe import GroupeCreate, GroupeUpdate, GroupeOut
from app.schemas.eleve import EleveOut


def _build_groupe_out(db: Session, g: Groupe) -> GroupeOut:
    """Helper interne pour construire GroupeOut avec les champs calculés."""
    count = db.query(InscriptionGroupe).filter(InscriptionGroupe.groupe_id == g.id).count()
    out = GroupeOut.model_validate(g)
    out.nombre_eleves = count
    out.enseignant_nom = g.enseignant.full_name if g.enseignant else None
    return out


def list_groupes(db: Session, centre_id: int) -> list[GroupeOut]:
    # Filtre les groupes non supprimés (deleted_at IS NULL)
    groupes = db.query(Groupe).filter(
        Groupe.centre_id == centre_id,
        Groupe.deleted_at == None  # noqa: E711
    ).all()
    return [_build_groupe_out(db, g) for g in groupes]


def get_groupe(db: Session, centre_id: int, groupe_id: int) -> GroupeOut:
    """Récupère un groupe actif (non supprimé). Lève 404 si soft-deleted."""
    g = db.query(Groupe).filter(
        Groupe.id == groupe_id,
        Groupe.centre_id == centre_id,
        Groupe.deleted_at == None  # noqa: E711
    ).first()
    if not g:
        raise HTTPException(status_code=404, detail="Groupe non trouvé")
    return _build_groupe_out(db, g)


def _get_groupe_raw(db: Session, centre_id: int, groupe_id: int) -> Groupe:
    """Récupère l'ORM Groupe actif brut (pour update/delete)."""
    g = db.query(Groupe).filter(
        Groupe.id == groupe_id,
        Groupe.centre_id == centre_id,
        Groupe.deleted_at == None  # noqa: E711
    ).first()
    if not g:
        raise HTTPException(status_code=404, detail="Groupe non trouvé")
    return g


def create_groupe(db: Session, centre_id: int, data: GroupeCreate) -> GroupeOut:
    if data.enseignant_id:
        ens = db.query(Utilisateur).filter(
            Utilisateur.id == data.enseignant_id,
            Utilisateur.centre_id == centre_id,
            Utilisateur.role == RoleEnum.enseignant
        ).first()
        if not ens:
            raise HTTPException(status_code=400, detail="Enseignant non trouvé dans ce centre")

    groupe = Groupe(**data.model_dump(), centre_id=centre_id)
    db.add(groupe)
    db.commit()
    db.refresh(groupe)
    return _build_groupe_out(db, groupe)


def update_groupe(db: Session, centre_id: int, groupe_id: int, data: GroupeUpdate) -> GroupeOut:
    g = _get_groupe_raw(db, centre_id, groupe_id)

    update_data = data.model_dump(exclude_unset=True)
    if "enseignant_id" in update_data and update_data["enseignant_id"] is not None:
        ens = db.query(Utilisateur).filter(
            Utilisateur.id == update_data["enseignant_id"],
            Utilisateur.centre_id == centre_id,
            Utilisateur.role == RoleEnum.enseignant
        ).first()
        if not ens:
            raise HTTPException(status_code=400, detail="Enseignant non trouvé dans ce centre")

    for field, val in update_data.items():
        setattr(g, field, val)

    db.commit()
    db.refresh(g)
    return _build_groupe_out(db, g)


def delete_groupe(db: Session, centre_id: int, groupe_id: int) -> None:
    """Soft delete — positionne deleted_at au timestamp actuel."""
    g = _get_groupe_raw(db, centre_id, groupe_id)
    g.deleted_at = func.now()
    db.commit()


def list_groupe_eleves(db: Session, centre_id: int, groupe_id: int) -> list[EleveOut]:
    _get_groupe_raw(db, centre_id, groupe_id)
    eleves = db.query(Eleve).join(InscriptionGroupe, InscriptionGroupe.eleve_id == Eleve.id)\
        .filter(InscriptionGroupe.groupe_id == groupe_id, Eleve.centre_id == centre_id, Eleve.deleted_at == None).all()
    return [EleveOut.model_validate(e) for e in eleves]


def add_eleve_to_groupe(db: Session, centre_id: int, groupe_id: int, eleve_id: int) -> None:
    g = _get_groupe_raw(db, centre_id, groupe_id)
    eleve = db.query(Eleve).filter(Eleve.id == eleve_id, Eleve.centre_id == centre_id, Eleve.deleted_at == None).first()
    if not eleve:
        raise HTTPException(status_code=404, detail="Élève non trouvé")

    # Check capacity
    count = db.query(InscriptionGroupe).filter(InscriptionGroupe.groupe_id == groupe_id).count()
    if count >= g.capacite_max:
        raise HTTPException(status_code=400, detail="Capacité maximale du groupe atteinte")

    # Check existing
    existing = db.query(InscriptionGroupe).filter(
        InscriptionGroupe.groupe_id == groupe_id,
        InscriptionGroupe.eleve_id == eleve_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Élève déjà inscrit dans ce groupe")

    inscription = InscriptionGroupe(groupe_id=groupe_id, eleve_id=eleve_id)
    db.add(inscription)
    db.commit()


def remove_eleve_from_groupe(db: Session, centre_id: int, groupe_id: int, eleve_id: int) -> None:
    _get_groupe_raw(db, centre_id, groupe_id)
    inscription = db.query(InscriptionGroupe).filter(
        InscriptionGroupe.groupe_id == groupe_id,
        InscriptionGroupe.eleve_id == eleve_id
    ).first()
    if not inscription:
        raise HTTPException(status_code=404, detail="Élève non trouvé dans ce groupe")
    db.delete(inscription)
    db.commit()

