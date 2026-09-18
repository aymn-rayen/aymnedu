from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date as date_type

from app.core.database import get_db
from app.api.routes.auth import require_role
from app.models import Utilisateur, RoleEnum
from app.schemas.presence import PresenceIn
from app.services import presence_service

router = APIRouter(prefix="/presences", tags=["présences"])

ROLE_DIR = RoleEnum.directeur.value
ROLE_SEC = RoleEnum.secretaire.value
ROLE_ENS = RoleEnum.enseignant.value


@router.get("")
def list_presences(
    groupe_id: int,
    date: date_type,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC, ROLE_ENS))
):
    return presence_service.list_presences(db, user.centre_id, groupe_id, date)


@router.post("/batch", status_code=204)
def save_presences(
    items: list[PresenceIn],
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC, ROLE_ENS))
):
    presence_service.save_presences_batch(db, user.centre_id, items)
