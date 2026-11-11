from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.api.routes.auth import get_current_user, require_role
from app.models import Utilisateur, RoleEnum
from app.services import subscription_service
from app.services.subscription_service import SubscriptionInfoOut

router = APIRouter(prefix="/subscription", tags=["abonnement"])

ROLE_DIR = RoleEnum.directeur.value


class ActivateCodeRequest(BaseModel):
    code: str


class PaymentInstructionsOut(BaseModel):
    montant_mensuel_dzd: int
    nom_beneficiaire: str
    ccp_compte: str
    baridimob_rip: str
    instructions: str
    contact_support: str


@router.get("", response_model=SubscriptionInfoOut)
def get_centre_subscription(
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(get_current_user)
):
    """Retourne l'état complet de l'abonnement du centre de l'utilisateur."""
    return subscription_service.get_subscription_info(db, user.centre_id)


@router.post("/activate", response_model=SubscriptionInfoOut)
def activate_subscription(
    body: ActivateCodeRequest,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR))
):
    """Active un code de licence / abonnement pour le centre (Directeur uniquement)."""
    return subscription_service.activate_subscription_code(db, user.centre_id, body.code)


@router.get("/instructions", response_model=PaymentInstructionsOut)
def get_payment_instructions(
    user: Utilisateur = Depends(get_current_user)
):
    """Retourne les coordonnées officielles BaridiMob / CCP pour régler l'abonnement en Algérie."""
    return PaymentInstructionsOut(
        montant_mensuel_dzd=4500,
        nom_beneficiaire="AymnEDU Technologies SARL",
        ccp_compte="0023456789 clé 45",
        baridimob_rip="00799999002345678945",
        instructions=(
            "Effectuez le virement de 4 500 DA via l'application BaridiMob ou par mandat CCP. "
            "Envoyez la capture d'écran du reçu au service commercial sur WhatsApp au +213 550 12 34 56 "
            "en indiquant le nom de votre centre. Votre code d'activation vous sera délivré sous 15 minutes."
        ),
        contact_support="+213 550 12 34 56 / contact@aymnedu.dz",
    )

