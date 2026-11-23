from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from fastapi import HTTPException
from typing import Optional, List

from app.models import Eleve, Paiement, PaiementStatutEnum, InscriptionGroupe, Groupe
from app.schemas.eleve import EleveCreate, EleveUpdate, EleveQuickSummary, EleveGroupeSummary, EleveUnpaidPaiement


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


def search_eleves(db: Session, centre_id: int, q: str) -> list[Eleve]:
    """
    Lightweight full-text search for the groupe-management modal.
    Returns up to 50 active eleves matching q (prenom or nom).
    """
    like = f"%{q}%"
    return (
        db.query(Eleve)
        .filter(
            Eleve.centre_id == centre_id,
            Eleve.deleted_at == None,  # noqa: E711
            Eleve.statut == "actif",
            (Eleve.prenom.ilike(like)) | (Eleve.nom.ilike(like))
        )
        .order_by(Eleve.nom, Eleve.prenom)
        .limit(50)
        .all()
    )


def quick_search_cashier(db: Session, centre_id: int, q: str) -> List[EleveQuickSummary]:
    """
    Killer Feature / Fast Cashier Search (Ctrl + K):
    Returns student card info with class/level, assigned groups, and unpaid dues.
    """
    if not q or len(q.strip()) < 2:
        return []

    like = f"%{q.strip()}%"
    eleves = (
        db.query(Eleve)
        .options(
            joinedload(Eleve.inscriptions).joinedload(InscriptionGroupe.groupe),
            joinedload(Eleve.paiements).joinedload(Paiement.groupe)
        )
        .filter(
            Eleve.centre_id == centre_id,
            Eleve.deleted_at == None,  # noqa: E711
            (Eleve.prenom.ilike(like)) | (Eleve.nom.ilike(like))
        )
        .order_by(Eleve.nom, Eleve.prenom)
        .limit(20)
        .all()
    )

    results: List[EleveQuickSummary] = []
    for el in eleves:
        # Groupes
        groupes_summary = [
            EleveGroupeSummary(
                id=ig.groupe.id,
                nom=ig.groupe.nom,
                matiere=ig.groupe.matiere,
                niveau=ig.groupe.niveau
            )
            for ig in el.inscriptions
            if ig.groupe and ig.groupe.deleted_at is None
        ]

        # Impayés et partiels
        impayes_list: List[EleveUnpaidPaiement] = []
        total_reste = 0.0

        for p in el.paiements:
            if p.statut in (PaiementStatutEnum.impaye, PaiementStatutEnum.partiel, "impaye", "partiel"):
                m_total = float(p.montant or 0)
                m_verse = float(p.montant_verse or 0)
                reste = max(0.0, m_total - m_verse)
                total_reste += reste
                impayes_list.append(
                    EleveUnpaidPaiement(
                        id=p.id,
                        groupe_id=p.groupe_id,
                        groupe_nom=p.groupe.nom if p.groupe else "Groupe",
                        mois=p.mois,
                        montant=m_total,
                        montant_verse=m_verse,
                        reste=reste,
                        statut=p.statut.value if hasattr(p.statut, 'value') else str(p.statut)
                    )
                )

        results.append(
            EleveQuickSummary(
                id=el.id,
                prenom=el.prenom,
                nom=el.nom,
                niveau=el.niveau,
                telephone_responsable=el.telephone_responsable,
                statut=el.statut.value if hasattr(el.statut, 'value') else str(el.statut),
                groupes=groupes_summary,
                total_reste_du=round(total_reste, 2),
                impayes=impayes_list
            )
        )

    return results


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
    from app.services.subscription_service import assert_subscription_allows_write
    assert_subscription_allows_write(db, centre_id)
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
