from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.models import Centre, Eleve, LicenseVoucher


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


def assert_subscription_active(db: Session, centre_id: int) -> SubscriptionInfoOut:
    """
    Vérifie si le centre a un abonnement ou un essai actif (non expiré, non suspendu).
    Lève HTTP 402 Payment Required si l'essai ou l'abonnement a expiré.
    Lève HTTP 403 Forbidden si le centre a été suspendu ou désactivé.
    """
    sub = get_subscription_info(db, centre_id)
    if sub.is_expired:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"L'accès en écriture du centre « {sub.nom_centre} » est bloqué : la période d'essai de 14 jours a expiré. "
                "Veuillez activer votre abonnement Soutien Pro pour continuer à utiliser la plateforme."
            )
        )
    if sub.subscription_status == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce centre d'étude a été suspendu par l'administration AymnEDU."
        )
    return sub


def assert_subscription_allows_write(db: Session, centre_id: int):
    """
    Vérifie l'abonnement actif ET le quota d'élèves pour la création de nouveaux élèves.
    """
    sub = assert_subscription_active(db, centre_id)
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
    Active un code de licence unique adossé à la table `license_vouchers`.
    Le code ne peut être utilisé qu'une seule fois.
    """
    clean_code = code.strip().upper()
    centre = db.query(Centre).filter(Centre.id == centre_id).first()
    if not centre:
        raise HTTPException(status_code=404, detail="Centre non trouvé")

    now = datetime.now()

    # Recherche et verrouillage atomique du coupon en base de données
    voucher = db.query(LicenseVoucher).filter(
        LicenseVoucher.code == clean_code,
        LicenseVoucher.is_redeemed == False  # noqa: E712
    ).with_for_update().first()

    if not voucher:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code d'activation invalide, expiré ou déjà utilisé. Contactez le support AymnEDU au +213 550 12 34 56."
        )

    # Base de calcul de l'expiration : si déjà actif, prolonger, sinon démarrer maintenant
    base_date = now
    if centre.subscription_expires_at:
        exp = centre.subscription_expires_at.replace(tzinfo=None) if centre.subscription_expires_at.tzinfo else centre.subscription_expires_at
        if exp > now:
            base_date = exp

    centre.subscription_plan = voucher.plan
    centre.subscription_status = "active"
    centre.subscription_expires_at = base_date + timedelta(days=voucher.duration_days)
    centre.max_eleves = voucher.max_eleves

    # Consommer le voucher (usage unique)
    voucher.is_redeemed = True
    voucher.redeemed_by_centre_id = centre.id
    voucher.redeemed_at = now

    db.commit()
    db.refresh(centre)
    return get_subscription_info(db, centre.id)

