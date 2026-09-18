from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.api.routes.auth import require_role
from app.models import Utilisateur, RoleEnum
from app.schemas.paiement import PaiementCreate, PaiementOut
from app.services import paiement_service

router = APIRouter(prefix="/paiements", tags=["paiements"])

ROLE_DIR = RoleEnum.directeur.value
ROLE_SEC = RoleEnum.secretaire.value


@router.get("")
def list_paiements(
    statut: Optional[str] = None,
    mois: Optional[str] = None,
    page: int = 1,
    size: int = 50,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC))
):
    return paiement_service.list_paiements(
        db, user.centre_id, statut=statut, mois=mois, page=page, size=size
    )


@router.post("", response_model=PaiementOut, status_code=201)
def create_paiement(
    body: PaiementCreate,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC))
):
    return paiement_service.create_paiement(db, user.centre_id, body)


@router.patch("/{id}/payer", response_model=PaiementOut)
def mark_paid(
    id: int,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC))
):
    return paiement_service.mark_paid(db, user.centre_id, id)
