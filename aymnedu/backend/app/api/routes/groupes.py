from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.routes.auth import require_role
from app.models import Utilisateur, RoleEnum
from app.schemas.groupe import GroupeCreate, GroupeUpdate, GroupeOut
from app.schemas.eleve import EleveOut
from app.services import groupe_service

router = APIRouter(prefix="/groupes", tags=["groupes"])

ROLE_DIR = RoleEnum.directeur.value
ROLE_SEC = RoleEnum.secretaire.value
ROLE_ENS = RoleEnum.enseignant.value


@router.get("", response_model=list[GroupeOut])
def list_groupes(
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC, ROLE_ENS))
):
    return groupe_service.list_groupes(db, user.centre_id)


@router.get("/{id}", response_model=GroupeOut)
def get_groupe(
    id: int,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC, ROLE_ENS))
):
    return groupe_service.get_groupe(db, user.centre_id, id)


@router.post("", response_model=GroupeOut, status_code=201)
def create_groupe(
    body: GroupeCreate,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR))
):
    return groupe_service.create_groupe(db, user.centre_id, body)


@router.put("/{id}", response_model=GroupeOut)
def update_groupe(
    id: int,
    body: GroupeUpdate,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC))
):
    return groupe_service.update_groupe(db, user.centre_id, id, body)


@router.delete("/{id}", status_code=204)
def delete_groupe(
    id: int,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR))
):
    groupe_service.delete_groupe(db, user.centre_id, id)


@router.get("/{id}/eleves", response_model=list[EleveOut])
def list_groupe_eleves(
    id: int,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC, ROLE_ENS))
):
    return groupe_service.list_groupe_eleves(db, user.centre_id, id)


@router.post("/{id}/eleves/{eleve_id}", status_code=201)
def add_eleve_to_groupe(
    id: int,
    eleve_id: int,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC))
):
    groupe_service.add_eleve_to_groupe(db, user.centre_id, id, eleve_id)
    return {"message": "Élève ajouté au groupe avec succès"}


@router.delete("/{id}/eleves/{eleve_id}", status_code=204)
def remove_eleve_from_groupe(
    id: int,
    eleve_id: int,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC))
):
    groupe_service.remove_eleve_from_groupe(db, user.centre_id, id, eleve_id)

