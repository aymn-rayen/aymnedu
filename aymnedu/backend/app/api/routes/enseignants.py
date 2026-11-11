from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.routes.auth import require_role
from app.models import Utilisateur, RoleEnum
from app.schemas.enseignant import EnseignantCreate, EnseignantOut
from app.services import enseignant_service

router = APIRouter(prefix="/enseignants", tags=["enseignants"])

ROLE_DIR = RoleEnum.directeur.value
ROLE_SEC = RoleEnum.secretaire.value
ROLE_ENS = RoleEnum.enseignant.value


@router.get("", response_model=list[EnseignantOut])
def list_enseignants(
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC, ROLE_ENS))
):
    return enseignant_service.list_enseignants(db, user.centre_id)


@router.post("", response_model=EnseignantOut, status_code=201)
def create_enseignant(
    body: EnseignantCreate,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR))
):
    return enseignant_service.create_enseignant(db, user.centre_id, body)


@router.delete("/{id}", status_code=204)
def delete_enseignant(
    id: int,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR))
):
    enseignant_service.delete_enseignant(db, user.centre_id, id)
