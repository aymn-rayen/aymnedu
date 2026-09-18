from pydantic import BaseModel
from typing import Optional
from datetime import date as date_type


class EleveBase(BaseModel):
    prenom: str
    nom: str
    telephone_responsable: Optional[str] = None
    niveau: Optional[str] = None


class EleveCreate(EleveBase):
    pass


class EleveUpdate(BaseModel):
    prenom: Optional[str] = None
    nom: Optional[str] = None
    telephone_responsable: Optional[str] = None
    niveau: Optional[str] = None
    statut: Optional[str] = None


class EleveOut(EleveBase):
    id: int
    centre_id: int
    date_inscription: Optional[date_type] = None
    statut: str

    class Config:
        from_attributes = True
