from sqlalchemy.orm import Session
from fastapi import HTTPException
from typing import Optional
from datetime import datetime

from app.models import Paiement, Eleve, Groupe
from app.schemas.paiement import PaiementCreate, PaiementOut


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
    items = q.offset((page - 1) * size).limit(size).all()
    result = []
    for p in items:
        out = PaiementOut.model_validate(p)
        out.eleve_nom = f"{p.eleve.prenom} {p.eleve.nom}" if p.eleve else None
        out.groupe_nom = p.groupe.nom if p.groupe else None
        result.append(out)

    return {
        "items": result,
        "total": total,
        "page": page,
        "size": size,
        "pages": -(-total // size)
    }


def create_paiement(db: Session, centre_id: int, data: PaiementCreate) -> PaiementOut:
    eleve = db.query(Eleve).filter(Eleve.id == data.eleve_id, Eleve.centre_id == centre_id).first()
    if not eleve:
        raise HTTPException(status_code=404, detail="Élève non trouvé")

    groupe = db.query(Groupe).filter(Groupe.id == data.groupe_id, Groupe.centre_id == centre_id).first()
    if not groupe:
        raise HTTPException(status_code=404, detail="Groupe non trouvé")

    p = Paiement(**data.model_dump(), centre_id=centre_id, statut="impaye")
    db.add(p)
    db.commit()
    db.refresh(p)

    out = PaiementOut.model_validate(p)
    out.eleve_nom = f"{eleve.prenom} {eleve.nom}"
    out.groupe_nom = groupe.nom
    return out


def mark_paid(db: Session, centre_id: int, paiement_id: int) -> PaiementOut:
    p = db.query(Paiement).filter(Paiement.id == paiement_id, Paiement.centre_id == centre_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Paiement non trouvé")

    p.statut = "paye"  # type: ignore
    p.date_paiement = datetime.utcnow()
    p.recu_numero = f"REC-{datetime.utcnow().strftime('%Y%m%d')}-{p.id:04d}"
    db.commit()
    db.refresh(p)

    out = PaiementOut.model_validate(p)
    out.eleve_nom = f"{p.eleve.prenom} {p.eleve.nom}" if p.eleve else None
    out.groupe_nom = p.groupe.nom if p.groupe else None
    return out
