from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional, List

from app.core.database import get_db
from app.api.routes.auth import require_role
from app.models import Utilisateur, RoleEnum
from app.schemas.eleve import (
    EleveCreate, EleveUpdate, EleveOut, EleveQuickSummary,
    EleveInscriptionCompleteRequest, EleveInscriptionCompleteOut
)
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


@router.get("/quick-search", response_model=List[EleveQuickSummary])
def quick_search_eleves(
    q: str,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC, ROLE_ENS))
):
    """
    Killer Feature / Fast Cashier Search (Ctrl + K):
    Returns student card info with class/level, assigned groups, and unpaid dues.
    """
    return eleve_service.quick_search_cashier(db, user.centre_id, q=q)


@router.get("/search", response_model=list[EleveOut])
def search_eleves(
    q: str,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC, ROLE_ENS))
):
    """
    Lightweight search endpoint for the groupe-management modal.
    Returns up to 50 matching active eleves for the current centre.
    Requires at least 2 characters to avoid returning the entire database.
    """
    return eleve_service.search_eleves(db, user.centre_id, q=q)


@router.post("", response_model=EleveOut, status_code=201)
def create_eleve(
    body: EleveCreate,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC))
):
    return eleve_service.create_eleve(db, user.centre_id, body)


@router.post("/inscription-complete", response_model=EleveInscriptionCompleteOut, status_code=201)
def inscription_complete(
    body: EleveInscriptionCompleteRequest,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_role(ROLE_DIR, ROLE_SEC))
):
    """
    Inscription 'Tout-en-un' en une seule transaction SQL atomique.
    Crée l'élève, l'affecte aux groupes, crée les échéances financières au tarif officiel (snapshot)
    et encaisse le 1er mois optionnellement avec émission de reçu.
    """
    return eleve_service.inscription_complete(db, user.centre_id, user.id, body)


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
