from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date

from app.core.database import get_db
from app.api.routes.auth import require_role
from app.models import Utilisateur, RoleEnum
from app.schemas.caisse import ClotureCaisseJourOut, FermerCaisseRequest, ValiderCaisseRequest
from app.services import caisse_service

router = APIRouter(prefix="/caisse", tags=["caisse"])

ROLE_DIR = RoleEnum.directeur.value
ROLE_SEC = RoleEnum.secretaire.value


@router.get("/jour", response_model=ClotureCaisseJourOut)
def get_caisse_jour(
    date_cloture: Optional[date] = None,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC))
):
    """
    Consulte la caisse du jour avec ventilation espèces, BaridiMob et liste des versements.
    Accessible à la Secrétaire et au Directeur.
    """
    return caisse_service.get_caisse_jour(db, user.centre_id, target_date=date_cloture)


@router.post("/fermer", response_model=ClotureCaisseJourOut)
def fermer_caisse(
    body: FermerCaisseRequest,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC))
):
    """
    Étape 2 : Fermeture du point de caisse par la secrétaire en fin de journée (saisie des espèces physiques).
    Calcule l'écart et passe la caisse en statut 'en_attente_validation'.
    """
    return caisse_service.fermer_caisse(
        db,
        user.centre_id,
        user.id,
        target_date=body.date_cloture,
        total_especes_reel=body.total_especes_reel,
        notes=body.notes
    )


@router.post("/valider", response_model=ClotureCaisseJourOut)
def valider_caisse(
    body: ValiderCaisseRequest,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR))
):
    """
    Étape 3 : Validation définitive par le Directeur.
    Verrouille la journée comptable après contrôle et recomptage des espèces.
    """
    return caisse_service.valider_caisse(
        db,
        user.centre_id,
        user.id,
        target_date=body.date_cloture
    )
