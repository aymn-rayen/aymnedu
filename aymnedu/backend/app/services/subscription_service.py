from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.models import Centre, Eleve


class SubscriptionInfoOut(BaseModel):
    centre_id: int
    nom_centre: str
    subscription_plan: str        # "starter" | "pro"
    subscription_status: str      # "trial" | "active" | "expired" | "suspended"
    trial_ends_at: Optional[datetime] = None
    subscription_expires_at: Optional[datetime] = None
    days_remaining: int
    is_expired: bool
    can_write: bool
    max_eleves: int
    current_eleves: int
    tarif_mensuel_dzd: int = 4500


def get_subscription_info(db: Session, centre_id: int) -> SubscriptionInfoOut:
    centre = db.query(Centre).filter(Centre.id == centre_id).first()
    if not centre:
        raise HTTPException(status_code=404, detail="Centre non trouvé")

    now = datetime.now()
    status_val = centre.subscription_status or "trial"
    days_left = 0
    is_expired = False

    # 1. Check trial expiration
    if status_val == "trial":
        if centre.trial_ends_at:
            # Handle naive datetime comparisons
            trial_end = centre.trial_ends_at.replace(tzinfo=None) if centre.trial_ends_at.tzinfo else centre.trial_ends_at
            if trial_end < now:
                status_val = "expired"
                centre.subscription_status = "expired"
                db.commit()
                is_expired = True
                days_left = 0
            else:
                delta = trial_end - now
                days_left = max(0, delta.days + (1 if delta.seconds > 0 else 0))
                is_expired = False
        else:
            # If no trial end date set, assign 14 days from now
            centre.trial_ends_at = now + timedelta(days=14)
            db.commit()
            days_left = 14
            is_expired = False

    # 2. Check active paid subscription expiration
    elif status_val == "active":
        if centre.subscription_expires_at:
            exp_date = centre.subscription_expires_at.replace(tzinfo=None) if centre.subscription_expires_at.tzinfo else centre.subscription_expires_at
            if exp_date < now:
                status_val = "expired"
                centre.subscription_status = "expired"
                db.commit()
                is_expired = True
                days_left = 0
            else:
                delta = exp_date - now
                days_left = max(0, delta.days + (1 if delta.seconds > 0 else 0))
                is_expired = False
        else:
            # Active without expiration = unlimited / perpetual
            days_left = 999
            is_expired = False

    elif status_val in ("expired", "suspended"):
        is_expired = True
        days_left = 0

    # Count active students
    current_eleves = db.query(Eleve).filter(
        Eleve.centre_id == centre_id,
        Eleve.deleted_at == None  # noqa: E711
    ).count()

    max_el = centre.max_eleves or (500 if centre.subscription_plan == "pro" else 50)
    can_write = (not is_expired) and (status_val != "suspended")

    return SubscriptionInfoOut(
        centre_id=centre.id,
        nom_centre=centre.nom,
        subscription_plan=centre.subscription_plan or "starter",
        subscription_status=status_val,
        trial_ends_at=centre.trial_ends_at,
        subscription_expires_at=centre.subscription_expires_at,
        days_remaining=days_left,
        is_expired=is_expired,
        can_write=can_write,
        max_eleves=max_el,
        current_eleves=current_eleves,
        tarif_mensuel_dzd=4500,
    )


def assert_subscription_allows_write(db: Session, centre_id: int):
    """
    Vérifie si le centre a le droit d'inscrire de nouveaux élèves ou d'enregistrer des opérations.
    Lève HTTP 402 si l'essai ou l'abonnement a expiré.
    """
    sub = get_subscription_info(db, centre_id)
    if sub.is_expired:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"L'abonnement du centre « {sub.nom_centre} » est expiré. "
                "Veuillez renouveler votre forfait Soutien Pro pour continuer à enregistrer de nouvelles entrées."
            )
        )
    if sub.subscription_status == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce centre d'étude a été suspendu par l'administration AymnEDU."
        )
    if sub.current_eleves >= sub.max_eleves:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Limite maximale d'élèves atteinte ({sub.current_eleves}/{sub.max_eleves}) "
                f"pour le forfait {sub.subscription_plan.upper()}. Passez au forfait supérieur."
            )
        )


def activate_subscription_code(db: Session, centre_id: int, code: str) -> SubscriptionInfoOut:
    """
    Active un code de licence ou prolonge la période de validité.
    Codes supportés pour le lancement :
      - AYMN-PRO-1MOIS : 1 mois Soutien Pro (30 jours)
      - AYMN-PRO-1AN   : 1 an Soutien Pro (365 jours)
      - AYMN-TRIAL-14  : Prolongation essai de 14 jours
    """
    clean_code = code.strip().upper()
    centre = db.query(Centre).filter(Centre.id == centre_id).first()
    if not centre:
        raise HTTPException(status_code=404, detail="Centre non trouvé")

    now = datetime.now()

    if clean_code in ("AYMN-PRO-1MOIS", "PRO30", "AYMNEDU30"):
        centre.subscription_plan = "pro"
        centre.subscription_status = "active"
        centre.subscription_expires_at = now + timedelta(days=30)
        centre.max_eleves = 500
    elif clean_code in ("AYMN-PRO-1AN", "PRO365", "AYMNEDU365"):
        centre.subscription_plan = "pro"
        centre.subscription_status = "active"
        centre.subscription_expires_at = now + timedelta(days=365)
        centre.max_eleves = 2000
    elif clean_code in ("AYMN-TRIAL-14", "TEST14"):
        centre.subscription_plan = "starter"
        centre.subscription_status = "trial"
        centre.trial_ends_at = now + timedelta(days=14)
        centre.max_eleves = 50
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code d'activation invalide ou expiré. Contactez le support AymnEDU au +213 550 12 34 56."
        )

    db.commit()
    db.refresh(centre)
    return get_subscription_info(db, centre.id)

