import logging
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.database import get_db
from app.core.security import verify_password, hash_password, create_access_token, decode_token
from app.models import PlatformAdmin, Centre, Eleve, LicenseVoucher
from app.api.routes.auth import oauth2_scheme

logger = logging.getLogger("aymnedu.admin")

router = APIRouter(prefix="/admin", tags=["Super Admin"])


# ── Schemas ──────────────────────────────────────────────────────────────────
class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin_name: str
    admin_email: str


class AdminStatsOut(BaseModel):
    total_centres: int
    active_trials: int
    active_paid: int
    expired_centres: int
    total_eleves: int
    mrr_estime_dzd: int


class CentreAdminView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nom: str
    wilaya: Optional[str] = None
    telephone: Optional[str] = None
    subscription_plan: str
    subscription_status: str
    trial_ends_at: Optional[datetime] = None
    subscription_expires_at: Optional[datetime] = None
    max_eleves: int
    is_active: bool
    created_at: Optional[datetime] = None
    total_eleves: int = 0


class ActivateCentreRequest(BaseModel):
    plan: str = "pro"
    duration_days: int = 30
    max_eleves: int = 500
    note: Optional[str] = None


class CreateVoucherRequest(BaseModel):
    plan: str = "pro"
    duration_days: int = 30
    max_eleves: int = 500
    count: int = Field(default=1, ge=1, le=50)
    note: Optional[str] = None


class VoucherOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    plan: str
    duration_days: int
    max_eleves: int
    is_redeemed: bool
    redeemed_by_centre_id: Optional[int] = None
    redeemed_by_centre_nom: Optional[str] = None
    redeemed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    note: Optional[str] = None


# ── Auth Helper & Dependency ────────────────────────────────────────────────
def _ensure_default_superadmin(db: Session) -> PlatformAdmin:
    """Crée le compte superadmin initial s'il n'en existe aucun."""
    admin = db.query(PlatformAdmin).first()
    if not admin:
        admin = PlatformAdmin(
            email="admin@aymnedu.dz",
            hashed_password=hash_password("admin123456"),
            full_name="Super Administrateur AymnEDU",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        logger.info("Default superadmin account initialized: admin@aymnedu.dz")
    return admin


def get_current_admin(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> PlatformAdmin:
    payload = decode_token(token)
    if not payload or not payload.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès réservé au Super Administrateur")

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")

    admin = db.query(PlatformAdmin).filter(PlatformAdmin.id == int(sub), PlatformAdmin.is_active == True).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte administrateur inactif ou inexistant")
    return admin


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/login", response_model=AdminTokenResponse)
def admin_login(body: AdminLoginRequest, db: Session = Depends(get_db)):
    """Connexion réservée au Super Administrateur AymnEDU."""
    _ensure_default_superadmin(db)
    admin = db.query(PlatformAdmin).filter(PlatformAdmin.email == body.email).first()
    if not admin or not verify_password(body.password, admin.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants super-admin incorrects")

    token = create_access_token({"sub": str(admin.id), "is_admin": True, "email": admin.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "admin_name": admin.full_name,
        "admin_email": admin.email,
    }


@router.get("/me")
def admin_me(admin: PlatformAdmin = Depends(get_current_admin)):
    return {
        "id": admin.id,
        "email": admin.email,
        "full_name": admin.full_name,
    }


@router.get("/stats", response_model=AdminStatsOut)
def admin_stats(db: Session = Depends(get_db), _: PlatformAdmin = Depends(get_current_admin)):
    """Statistiques globales de la plateforme AymnEDU."""
    total_centres = db.query(Centre).count()
    active_trials = db.query(Centre).filter(Centre.subscription_status == "trial", Centre.is_active == True).count()
    active_paid = db.query(Centre).filter(Centre.subscription_status == "active", Centre.is_active == True).count()
    expired_centres = db.query(Centre).filter(Centre.subscription_status == "expired").count()
    total_eleves = db.query(Eleve).filter(Eleve.deleted_at == None).count()  # noqa: E711
    mrr_estime = active_paid * 4500  # Tarif standard Soutien Pro 4 500 DA/mois

    return {
        "total_centres": total_centres,
        "active_trials": active_trials,
        "active_paid": active_paid,
        "expired_centres": expired_centres,
        "total_eleves": total_eleves,
        "mrr_estime_dzd": mrr_estime,
    }


@router.get("/centres", response_model=List[CentreAdminView])
def list_all_centres(db: Session = Depends(get_db), _: PlatformAdmin = Depends(get_current_admin)):
    """Liste exhaustive de tous les centres enregistrés."""
    centres = db.query(Centre).order_by(Centre.created_at.desc()).all()
    result = []
    for c in centres:
        count = db.query(Eleve).filter(Eleve.centre_id == c.id, Eleve.deleted_at == None).count()  # noqa: E711
        item = CentreAdminView.model_validate(c)
        item.total_eleves = count
        result.append(item)
    return result


@router.post("/centres/{centre_id}/activate")
def manual_activate_centre(
    centre_id: int,
    body: ActivateCentreRequest,
    db: Session = Depends(get_db),
    _: PlatformAdmin = Depends(get_current_admin)
):
    """
    Validation manuelle d'un paiement (BaridiMob, virement CCP, espèces).
    Prolonge immédiatement l'abonnement du centre.
    """
    centre = db.query(Centre).filter(Centre.id == centre_id).first()
    if not centre:
        raise HTTPException(status_code=404, detail="Centre non trouvé")

    now = datetime.now()
    base_date = now
    if centre.subscription_expires_at:
        exp = centre.subscription_expires_at.replace(tzinfo=None) if centre.subscription_expires_at.tzinfo else centre.subscription_expires_at
        if exp > now:
            base_date = exp

    centre.subscription_plan = body.plan
    centre.subscription_status = "active"
    centre.subscription_expires_at = base_date + timedelta(days=body.duration_days)
    centre.max_eleves = body.max_eleves
    centre.is_active = True

    db.commit()
    db.refresh(centre)
    return {
        "message": f"Abonnement prolongé de {body.duration_days} jours avec succès.",
        "centre_id": centre.id,
        "subscription_status": centre.subscription_status,
        "subscription_expires_at": centre.subscription_expires_at,
    }


@router.post("/centres/{centre_id}/toggle-status")
def toggle_centre_status(
    centre_id: int,
    db: Session = Depends(get_db),
    _: PlatformAdmin = Depends(get_current_admin)
):
    """Suspend ou réactive l'accès d'un centre."""
    centre = db.query(Centre).filter(Centre.id == centre_id).first()
    if not centre:
        raise HTTPException(status_code=404, detail="Centre non trouvé")

    centre.is_active = not centre.is_active
    if not centre.is_active:
        centre.subscription_status = "suspended"
    else:
        centre.subscription_status = "active" if centre.subscription_expires_at and centre.subscription_expires_at > datetime.now() else "trial"

    db.commit()
    db.refresh(centre)
    return {
        "centre_id": centre.id,
        "is_active": centre.is_active,
        "subscription_status": centre.subscription_status,
    }


# ── Vouchers Management ──────────────────────────────────────────────────────

def _generate_code(plan: str, days: int) -> str:
    """Génère un code lisible type AYMN-PRO30-8K2M-9X1Z."""
    chars = "".join(c for c in string.ascii_uppercase + string.digits if c not in "OI01")
    part1 = "".join(secrets.choice(chars) for _ in range(4))
    part2 = "".join(secrets.choice(chars) for _ in range(4))
    prefix = "PRO" if plan == "pro" else "START"
    duration = "365" if days >= 300 else "30"
    return f"AYMN-{prefix}{duration}-{part1}-{part2}"


@router.get("/vouchers", response_model=List[VoucherOut])
def list_vouchers(db: Session = Depends(get_db), _: PlatformAdmin = Depends(get_current_admin)):
    """Liste tous les coupons de licence générés."""
    vouchers = db.query(LicenseVoucher).order_by(LicenseVoucher.created_at.desc()).all()
    result = []
    for v in vouchers:
        item = VoucherOut.model_validate(v)
        if v.redeemed_by:
            item.redeemed_by_centre_nom = v.redeemed_by.nom
        result.append(item)
    return result


@router.post("/vouchers", response_model=List[VoucherOut])
def create_vouchers(
    body: CreateVoucherRequest,
    db: Session = Depends(get_db),
    _: PlatformAdmin = Depends(get_current_admin)
):
    """Génère un ou plusieurs coupons de licence à usage unique."""
    created = []
    for _ in range(body.count):
        code = _generate_code(body.plan, body.duration_days)
        # S'assurer de l'unicité
        while db.query(LicenseVoucher).filter(LicenseVoucher.code == code).first():
            code = _generate_code(body.plan, body.duration_days)

        voucher = LicenseVoucher(
            code=code,
            plan=body.plan,
            duration_days=body.duration_days,
            max_eleves=body.max_eleves,
            is_redeemed=False,
            note=body.note,
        )
        db.add(voucher)
        created.append(voucher)

    db.commit()
    for v in created:
        db.refresh(v)

    return [VoucherOut.model_validate(v) for v in created]
