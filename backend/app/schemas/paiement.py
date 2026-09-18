from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PaiementCreate(BaseModel):
    eleve_id: int
    groupe_id: int
    montant: float
    mois: str


class PaiementOut(BaseModel):
    id: int
    eleve_id: int
    groupe_id: int
    montant: float
    mois: str
    statut: str
    date_paiement: Optional[datetime] = None
    recu_numero: Optional[str] = None
    eleve_nom: Optional[str] = None
    groupe_nom: Optional[str] = None

    class Config:
        from_attributes = True
