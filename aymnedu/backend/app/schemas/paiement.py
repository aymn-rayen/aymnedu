from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class VersementCreate(BaseModel):
    montant: Decimal = Field(..., gt=0, description="Montant exact en dinars")
    mode_reglement: str = "especes"


class VersementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    paiement_id: int
    montant: float
    mode_reglement: str
    recu_numero: str
    date_versement: datetime
    recu_par_nom: Optional[str] = None


class PaiementCreate(BaseModel):
    eleve_id: int
    groupe_id: int
    montant: Decimal = Field(..., gt=0)
    mois: str


class VersementRequest(BaseModel):
    """Montant à verser (partiel ou total) avec mode de paiement."""
    montant_verse: Optional[Decimal] = None
    montant: Optional[Decimal] = None
    mode_reglement: Optional[str] = "especes"

    @model_validator(mode="after")
    def populate_montant_verse(self):
        val = self.montant_verse if self.montant_verse is not None else self.montant
        if val is None or val <= 0:
            raise ValueError("Le montant versé doit être strictement supérieur à zéro.")
        self.montant_verse = val
        return self


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
    versements: List[VersementOut] = []
