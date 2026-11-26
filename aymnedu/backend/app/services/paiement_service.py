from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException
from typing import Optional, List
from decimal import Decimal
from datetime import datetime, timezone
import secrets

from app.models import Paiement, Eleve, Groupe, Versement, PaiementStatutEnum
from app.schemas.paiement import PaiementCreate, PaiementOut, VersementOut


def _enrich(p: Paiement) -> PaiementOut:
    out = PaiementOut.model_validate(p)
    out.montant       = float(p.montant)
    out.montant_verse = float(p.montant_verse)
    out.eleve_nom  = f"{p.eleve.prenom} {p.eleve.nom}" if p.eleve else None
    out.groupe_nom = p.groupe.nom if p.groupe else None
    if hasattr(p, 'versements') and p.versements:
        out.versements = [
            VersementOut(
                id=v.id,
                paiement_id=v.paiement_id,
                montant=float(v.montant),
                mode_reglement=v.mode_reglement.value if hasattr(v.mode_reglement, 'value') else str(v.mode_reglement),
                recu_numero=v.recu_numero,
                date_versement=v.date_versement,
                recu_par_nom=v.recu_par.full_name if v.recu_par else None,
            )
            for v in p.versements
        ]
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
        q.options(
            joinedload(Paiement.eleve),
            joinedload(Paiement.groupe),
            joinedload(Paiement.versements).joinedload(Versement.recu_par)
        )
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
    from app.services.subscription_service import assert_subscription_allows_write
    assert_subscription_allows_write(db, centre_id)

    # Vérification d'existence de l'élève et du groupe dans le centre
    eleve = db.query(Eleve).filter(
        Eleve.id == data.eleve_id,
        Eleve.centre_id == centre_id,
        Eleve.deleted_at == None  # noqa: E711
    ).first()
    if not eleve:
        raise HTTPException(status_code=404, detail="Élève non trouvé dans votre centre")

    groupe = db.query(Groupe).filter(
        Groupe.id == data.groupe_id,
        Groupe.centre_id == centre_id,
        Groupe.deleted_at == None  # noqa: E711
    ).first()
    if not groupe:
        raise HTTPException(status_code=404, detail="Groupe non trouvé dans votre centre")

    existing = db.query(Paiement).filter(
        Paiement.eleve_id == data.eleve_id,
        Paiement.groupe_id == data.groupe_id,
        Paiement.mois == data.mois
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Un paiement existe déjà pour cet élève, ce groupe et ce mois")

    p = Paiement(
        centre_id=centre_id,
        eleve_id=data.eleve_id,
        groupe_id=data.groupe_id,
        montant=Decimal(str(data.montant)),
        montant_verse=Decimal("0.00"),
        mois=data.mois,
        statut=PaiementStatutEnum.impaye,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _enrich(p)


def mark_paid(db: Session, centre_id: int, paiement_id: int, user_id: Optional[int] = None) -> PaiementOut:
    """Encaissement total direct (solde le reste dû) avec verrou pessimiste."""
    # Verrou pessimiste de ligne (with_for_update)
    p = db.query(Paiement).filter(
        Paiement.id == paiement_id,
        Paiement.centre_id == centre_id
    ).with_for_update().first()

    if not p:
        raise HTTPException(status_code=404, detail="Paiement non trouvé")

    reste = Decimal(str(p.montant)) - Decimal(str(p.montant_verse or 0))
    if reste <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Paiement déjà soldé")

    return verser(db, centre_id, paiement_id, reste, user_id=user_id, mode_reglement="especes")


def verser(
    db: Session,
    centre_id: int,
    paiement_id: int,
    montant_verse_add: Decimal,
    user_id: Optional[int] = None,
    mode_reglement: str = "especes"
) -> PaiementOut:
    """
    Versement partiel ou solde du paiement :
    - Manipulation stricte en Decimal (aucune perte de précision float).
    - Verrou pessimiste with_for_update() contre les race conditions.
    - Création d'une ligne d'historique dans la table `versements` avec reçu unique.
    """
    from app.services.subscription_service import assert_subscription_allows_write
    assert_subscription_allows_write(db, centre_id)

    # 1. Verrouillage de la ligne de paiement
    p = db.query(Paiement).filter(
        Paiement.id == paiement_id,
        Paiement.centre_id == centre_id,
    ).with_for_update().first()

    if not p:
        raise HTTPException(status_code=404, detail="Paiement non trouvé")
    if p.statut == PaiementStatutEnum.paye:
        raise HTTPException(status_code=400, detail="Ce paiement est déjà soldé")

    montant_add = Decimal(str(montant_verse_add)).quantize(Decimal("0.01"))
    if montant_add <= Decimal("0.00"):
        raise HTTPException(status_code=422, detail="Le montant à verser doit être strictement positif.")

    montant_total = Decimal(str(p.montant)).quantize(Decimal("0.01"))
    deja_verse    = Decimal(str(p.montant_verse or 0)).quantize(Decimal("0.01"))
    reste         = montant_total - deja_verse

    if montant_add > reste:
        raise HTTPException(
            status_code=422,
            detail=f"Le montant saisi ({montant_add} DA) dépasse le solde restant ({reste} DA).",
        )

    # 2. Mise à jour du cumul et date
    nouveau_verse = (deja_verse + montant_add).quantize(Decimal("0.01"))
    now_utc = datetime.now(timezone.utc)
    p.montant_verse = nouveau_verse
    p.date_paiement = now_utc

    # Génération d'un numéro de reçu unique pour CET encaissement précis
    date_code = now_utc.strftime("%Y%m%d")
    recu_unique = f"REC-{date_code}-{p.id:04d}-{secrets.token_hex(3).upper()}"
    p.recu_numero = recu_unique

    if nouveau_verse >= montant_total:
        p.statut = PaiementStatutEnum.paye
    else:
        p.statut = PaiementStatutEnum.partiel

    # 3. Création de la ligne d'historique comptable (Table versements)
    v = Versement(
        paiement_id=p.id,
        centre_id=centre_id,
        recu_par_user_id=user_id,
        montant=montant_add,
        mode_reglement=mode_reglement,
        recu_numero=recu_unique,
        date_versement=now_utc,
    )
    db.add(v)

    db.commit()
    db.refresh(p)
    return _enrich(p)
