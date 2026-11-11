from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class PaiementCreate(BaseModel):
    eleve_id: int
    groupe_id: int
    montant: float
    mois: str


class VersementRequest(BaseModel):
    """Montant à verser (partiel ou total)."""
    montant_verse: float


class PaiementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    eleve_id: int
    groupe_id: int
    montant: float
    montant_verse: float = 0.0
    mois: str
    statut: str
    date_paiement: Optional[datetime] = None
    recu_numero: Optional[str] = None
    eleve_nom: Optional[str] = None
    groupe_nom: Optional[str] = None
