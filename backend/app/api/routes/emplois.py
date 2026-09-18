from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.routes.auth import require_role
from app.models import Utilisateur, RoleEnum
from app.schemas.seance import SeanceCreate, SeanceUpdate, SeanceOut
from app.services import seance_service

router = APIRouter(prefix="/emplois-du-temps", tags=["planning"])

ROLE_DIR = RoleEnum.directeur.value
ROLE_SEC = RoleEnum.secretaire.value
ROLE_ENS = RoleEnum.enseignant.value


@router.get("", response_model=list[SeanceOut])
def list_seances(
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC, ROLE_ENS))
):
    return seance_service.list_seances(db, user.centre_id)


@router.post("", response_model=SeanceOut, status_code=201)
def create_seance(
    body: SeanceCreate,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR))
):
    return seance_service.create_seance(db, user.centre_id, body)


@router.put("/{id}", response_model=SeanceOut)
def update_seance(
    id: int,
    body: SeanceUpdate,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR))
):
    return seance_service.update_seance(db, user.centre_id, id, body)


@router.delete("/{id}", status_code=204)
def delete_seance(
    id: int,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR))
):
    seance_service.delete_seance(db, user.centre_id, id)
