from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException
from typing import Optional
from decimal import Decimal
from datetime import datetime, timezone

from app.models import Paiement, Eleve, Groupe
from app.schemas.paiement import PaiementCreate, PaiementOut


def _enrich(p: Paiement) -> PaiementOut:
    out = PaiementOut.model_validate(p)
    out.montant       = float(p.montant)
    out.montant_verse = float(p.montant_verse)
    out.eleve_nom  = f"{p.eleve.prenom} {p.eleve.nom}" if p.eleve else None
    out.groupe_nom = p.groupe.nom if p.groupe else None
    return out


def list_paiements(
    db: Session,
    centre_id: int,
    statut: Optional[str] = None,
    mois: Optional[str] = None,
    page: int = 1,
    size: int = 50
):
    q = db.query(Paiement).filter(Paiement.centre_id == centre_id)
    if statut:
        q = q.filter(Paiement.statut == statut)
    if mois and mois not in ("all", "0", ""):
        if "-" in mois:
            q = q.filter(Paiement.mois == mois)
        else:
            try:
                m_num = int(mois)
                q = q.filter(Paiement.mois.like(f"%-{m_num:02d}"))
            except ValueError:
                q = q.filter(Paiement.mois.startswith(mois))

    total = q.count()
    items = (
        q.options(joinedload(Paiement.eleve), joinedload(Paiement.groupe))
        .order_by(Paiement.id.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    return {
        "items":  [_enrich(p) for p in items],
        "total":  total,
        "page":   page,
        "size":   size,
        "pages":  -(-total // size),
    }


def create_paiement(db: Session, centre_id: int, data: PaiementCreate) -> PaiementOut:
    eleve  = db.query(Eleve).filter(Eleve.id == data.eleve_id,   Eleve.centre_id == centre_id).first()
    groupe = db.query(Groupe).filter(Groupe.id == data.groupe_id, Groupe.centre_id == centre_id).first()
    if not eleve:
        raise HTTPException(status_code=404, detail="Élève non trouvé")
    if not groupe:
        raise HTTPException(status_code=404, detail="Groupe non trouvé")

    p = Paiement(
        **data.model_dump(),
        centre_id=centre_id,
        statut="impaye",
        montant_verse=Decimal("0"),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _enrich(p)


def mark_paid(db: Session, centre_id: int, paiement_id: int) -> PaiementOut:
    """Encaissement total (100 % du montant dû)."""
    p = db.query(Paiement).filter(
        Paiement.id == paiement_id,
        Paiement.centre_id == centre_id,
    ).options(joinedload(Paiement.eleve), joinedload(Paiement.groupe)).first()
    if not p:
        raise HTTPException(status_code=404, detail="Paiement non trouvé")
    if p.statut == "paye":
        raise HTTPException(status_code=400, detail="Paiement déjà soldé")

    p.montant_verse = p.montant  # type: ignore
    p.statut        = "paye"      # type: ignore
    p.date_paiement = datetime.now(timezone.utc)
    p.recu_numero   = f"REC-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{p.id:04d}"
    db.commit()
    db.refresh(p)
    return _enrich(p)


def verser(db: Session, centre_id: int, paiement_id: int, montant_verse_add: float) -> PaiementOut:
    """Versement partiel ou solde du paiement.

    - Si montant_verse_add + déjà versé >= montant total → statut paye + reçu
    - Sinon → statut partiel
    """
    p = db.query(Paiement).filter(
        Paiement.id == paiement_id,
        Paiement.centre_id == centre_id,
    ).options(joinedload(Paiement.eleve), joinedload(Paiement.groupe)).first()
    if not p:
        raise HTTPException(status_code=404, detail="Paiement non trouvé")
    if p.statut == "paye":
        raise HTTPException(status_code=400, detail="Paiement déjà soldé")

    montant_total  = float(p.montant)
    deja_verse     = float(p.montant_verse)
    reste          = montant_total - deja_verse

    if montant_verse_add <= 0:
        raise HTTPException(status_code=422, detail="Le montant à verser doit être positif.")
    if montant_verse_add > reste + 0.01:  # tolérance arrondi
        raise HTTPException(
            status_code=422,
            detail=f"Le montant saisi ({montant_verse_add:.2f} DA) dépasse le solde restant ({reste:.2f} DA).",
        )

    nouveau_verse = deja_verse + montant_verse_add
    p.montant_verse  = Decimal(str(round(nouveau_verse, 2)))  # type: ignore
    p.date_paiement  = datetime.now(timezone.utc)

    if round(nouveau_verse, 2) >= round(montant_total, 2):
        p.statut      = "paye"  # type: ignore
        p.recu_numero = f"REC-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{p.id:04d}"
    else:
        p.statut = "partiel"  # type: ignore

    db.commit()
    db.refresh(p)
    return _enrich(p)
