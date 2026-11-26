from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from decimal import Decimal


class GroupeBase(BaseModel):
    nom: str
    matiere: Optional[str] = None
    niveau: Optional[str] = None
    capacite_max: int = 20
    tarif: Decimal = Field(default=Decimal("2500.00"), ge=0, description="Tarif mensuel officiel en DZD")
    enseignant_id: Optional[int] = None


class GroupeCreate(GroupeBase):
    pass


class GroupeUpdate(BaseModel):
    nom: Optional[str] = None
    matiere: Optional[str] = None
    niveau: Optional[str] = None
    capacite_max: Optional[int] = None
    tarif: Optional[Decimal] = Field(default=None, ge=0)
    enseignant_id: Optional[int] = None


class GroupeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    centre_id: int
    nom: str
    matiere: Optional[str] = None
    niveau: Optional[str] = None
    capacite_max: int
    tarif: float = 2500.0
    enseignant_id: Optional[int] = None
    enseignant_nom: Optional[str] = None
    nombre_eleves: int = 0
