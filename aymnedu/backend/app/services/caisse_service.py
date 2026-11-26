from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, cast, Date
from fastapi import HTTPException, status
from typing import Optional, List
from datetime import date as date_type, datetime, timezone
from decimal import Decimal

from app.models import (
    ClotureCaisse, ClotureStatutEnum, Versement, VersementModeEnum,
    Paiement, Eleve, Groupe, Utilisateur
)
from app.schemas.caisse import ClotureCaisseJourOut, VersementDetailOut


def get_caisse_jour(
    db: Session,
    centre_id: int,
    target_date: Optional[date_type] = None
) -> ClotureCaisseJourOut:
    """
    Consulte ou initialise la caisse de la journée :
    - Calcule en temps réel le total espèces, le total baridimob et le nombre de versements.
    - Synchronise ou crée l'enregistrement `ClotureCaisse` si statut == 'ouverte'.
    - Retourne la liste détaillée des versements du jour avec agents, élèves et reçus.
    """
    if target_date is None:
        target_date = datetime.now(timezone.utc).date()

    start_dt = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0)
    end_dt = datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59, 999999)

    # 1. Récupération des versements de cette journée
    versements = (
        db.query(Versement)
        .options(
            joinedload(Versement.recu_par),
            joinedload(Versement.paiement).joinedload(Paiement.eleve),
            joinedload(Versement.paiement).joinedload(Paiement.groupe),
        )
        .filter(
            Versement.centre_id == centre_id,
            Versement.date_versement >= start_dt,
            Versement.date_versement <= end_dt
        )
        .order_by(Versement.date_versement.desc())
        .all()
    )

    total_especes = Decimal("0.00")
    total_baridimob = Decimal("0.00")
    versement_details: List[VersementDetailOut] = []

    for v in versements:
        m = Decimal(str(v.montant or 0)).quantize(Decimal("0.01"))
        mode_val = v.mode_reglement.value if hasattr(v.mode_reglement, 'value') else str(v.mode_reglement)
        if mode_val == "especes":
            total_especes += m
        else:
            total_baridimob += m

        eleve_nom = f"{v.paiement.eleve.prenom} {v.paiement.eleve.nom}" if v.paiement and v.paiement.eleve else None
        groupe_nom = v.paiement.groupe.nom if v.paiement and v.paiement.groupe else None

        versement_details.append(
            VersementDetailOut(
                id=v.id,
                recu_numero=v.recu_numero,
                montant=float(m),
                mode_reglement=mode_val,
                date_versement=v.date_versement,
                recu_par_nom=v.recu_par.full_name if v.recu_par else None,
                eleve_nom=eleve_nom,
                groupe_nom=groupe_nom,
            )
        )

    # 2. Récupération ou création de l'enregistrement ClotureCaisse
    cloture = db.query(ClotureCaisse).filter(
        ClotureCaisse.centre_id == centre_id,
        ClotureCaisse.date_cloture == target_date
    ).first()

    if not cloture:
        cloture = ClotureCaisse(
            centre_id=centre_id,
            date_cloture=target_date,
            statut=ClotureStatutEnum.ouverte,
            total_especes_theorique=total_especes,
            total_baridimob_theorique=total_baridimob,
            nb_versements=len(versements),
        )
        db.add(cloture)
        db.commit()
        db.refresh(cloture)
    elif cloture.statut == ClotureStatutEnum.ouverte:
        # Met à jour les théoriques au fil de l'eau tant que la caisse est ouverte
        cloture.total_especes_theorique = total_especes
        cloture.total_baridimob_theorique = total_baridimob
        cloture.nb_versements = len(versements)
        db.commit()
        db.refresh(cloture)

    tot_theorique = Decimal(str(cloture.total_especes_theorique)) + Decimal(str(cloture.total_baridimob_theorique))

    statut_val = cloture.statut.value if hasattr(cloture.statut, 'value') else str(cloture.statut)

    return ClotureCaisseJourOut(
        date_cloture=cloture.date_cloture,
        statut=statut_val,
        total_especes_theorique=float(cloture.total_especes_theorique),
        total_baridimob_theorique=float(cloture.total_baridimob_theorique),
        total_theorique=float(tot_theorique),
        total_especes_reel=float(cloture.total_especes_reel) if cloture.total_especes_reel is not None else None,
        ecart=float(cloture.ecart) if cloture.ecart is not None else None,
        nb_versements=cloture.nb_versements,
        notes=cloture.notes,
        ferme_par_nom=cloture.ferme_par.full_name if cloture.ferme_par else None,
        valide_par_nom=cloture.valide_par.full_name if cloture.valide_par else None,
        date_fermeture=cloture.date_fermeture,
        date_validation=cloture.date_validation,
        versements=versement_details,
    )


def fermer_caisse(
    db: Session,
    centre_id: int,
    user_id: int,
    target_date: Optional[date_type],
    total_especes_reel: Decimal,
    notes: Optional[str] = None
) -> ClotureCaisseJourOut:
    """
    Étape 2 (Secrétaire ou Directeur) : Clôture de fin de journée.
    - Saisie du montant physique recompté en liquide dans le tiroir-caisse.
    - Calcul de l'écart : Écart = Réel - Théorique.
    - Statut basculé en 'en_attente_validation'.
    """
    if target_date is None:
        target_date = datetime.now(timezone.utc).date()

    cloture = db.query(ClotureCaisse).filter(
        ClotureCaisse.centre_id == centre_id,
        ClotureCaisse.date_cloture == target_date
    ).with_for_update().first()

    if not cloture:
        # Initialise d'abord si elle n'a pas encore été consultée
        get_caisse_jour(db, centre_id, target_date)
        cloture = db.query(ClotureCaisse).filter(
            ClotureCaisse.centre_id == centre_id,
            ClotureCaisse.date_cloture == target_date
        ).with_for_update().first()

    if cloture.statut == ClotureStatutEnum.validee:
        raise HTTPException(
            status_code=400,
            detail="Cette caisse a déjà été validée et verrouillée par le directeur."
        )

    reel = Decimal(str(total_especes_reel)).quantize(Decimal("0.01"))
    theorique = Decimal(str(cloture.total_especes_theorique)).quantize(Decimal("0.01"))
    ecart = reel - theorique

    cloture.total_especes_reel = reel
    cloture.ecart = ecart
    cloture.notes = notes
    cloture.ferme_par_user_id = user_id
    cloture.date_fermeture = datetime.now(timezone.utc)
    cloture.statut = ClotureStatutEnum.en_attente_validation

    db.commit()
    return get_caisse_jour(db, centre_id, target_date)


def valider_caisse(
    db: Session,
    centre_id: int,
    user_id: int,
    target_date: Optional[date_type] = None
) -> ClotureCaisseJourOut:
    """
    Étape 3 (Directeur UNIQUEMENT) : Validation finale de la caisse.
    - Recomptage et accord du directeur.
    - Statut basculé en 'validee'. Verrouillage définitif.
    """
    if target_date is None:
        target_date = datetime.now(timezone.utc).date()

    cloture = db.query(ClotureCaisse).filter(
        ClotureCaisse.centre_id == centre_id,
        ClotureCaisse.date_cloture == target_date
    ).with_for_update().first()

    if not cloture:
        raise HTTPException(status_code=404, detail="Aucun point de caisse trouvé pour cette date.")

    if cloture.statut != ClotureStatutEnum.en_attente_validation:
        raise HTTPException(
            status_code=400,
            detail="La caisse doit d'abord être fermée par la secrétaire (en attente de validation) avant d'être validée."
        )

    cloture.valide_par_user_id = user_id
    cloture.date_validation = datetime.now(timezone.utc)
    cloture.statut = ClotureStatutEnum.validee

    db.commit()
    return get_caisse_jour(db, centre_id, target_date)
