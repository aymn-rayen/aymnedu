from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.api.routes.auth import require_role
from app.models import Utilisateur, RoleEnum
from app.schemas.eleve import EleveCreate, EleveUpdate, EleveOut
from app.services import eleve_service

router = APIRouter(prefix="/eleves", tags=["élèves"])

ROLE_DIR = RoleEnum.directeur.value
ROLE_SEC = RoleEnum.secretaire.value
ROLE_ENS = RoleEnum.enseignant.value


@router.get("")
def list_eleves(
    q: Optional[str] = None,
    page: int = 1,
    size: int = 25,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC, ROLE_ENS))
):
    return eleve_service.list_eleves(db, user.centre_id, q=q, page=page, size=size)


@router.post("", response_model=EleveOut, status_code=201)
def create_eleve(
    body: EleveCreate,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC))
):
    return eleve_service.create_eleve(db, user.centre_id, body)


@router.get("/{id}", response_model=EleveOut)
def get_eleve(
    id: int,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC, ROLE_ENS))
):
    return eleve_service.get_eleve(db, user.centre_id, id)


@router.put("/{id}", response_model=EleveOut)
def update_eleve(
    id: int,
    body: EleveUpdate,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC))
):
    return eleve_service.update_eleve(db, user.centre_id, id, body)


@router.delete("/{id}", status_code=204)
def delete_eleve(
    id: int,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR))
):
    eleve_service.delete_eleve(db, user.centre_id, id)
