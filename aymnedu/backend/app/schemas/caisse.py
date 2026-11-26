from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal


class VersementDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    recu_numero: str
    montant: float
    mode_reglement: str
    date_versement: datetime
    recu_par_nom: Optional[str] = None
    eleve_nom: Optional[str] = None
    groupe_nom: Optional[str] = None


class ClotureCaisseJourOut(BaseModel):
    date_cloture: date
    statut: str  # "ouverte" | "en_attente_validation" | "validee"
    total_especes_theorique: float
    total_baridimob_theorique: float
    total_theorique: float
    total_especes_reel: Optional[float] = None
    ecart: Optional[float] = None
    nb_versements: int
    notes: Optional[str] = None
    ferme_par_nom: Optional[str] = None
    valide_par_nom: Optional[str] = None
    date_fermeture: Optional[datetime] = None
    date_validation: Optional[datetime] = None
    versements: List[VersementDetailOut] = []


class FermerCaisseRequest(BaseModel):
    date_cloture: Optional[date] = None
    total_especes_reel: Decimal = Field(..., ge=0, description="Montant physique recompté en caisse")
    notes: Optional[str] = None


class ValiderCaisseRequest(BaseModel):
    date_cloture: Optional[date] = None
