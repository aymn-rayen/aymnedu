from pydantic import BaseModel
from typing import Optional


class GroupeBase(BaseModel):
    nom: str
    matiere: Optional[str] = None
    niveau: Optional[str] = None
    capacite_max: int = 20
    enseignant_id: Optional[int] = None


class GroupeCreate(GroupeBase):
    pass


class GroupeUpdate(BaseModel):
    nom: Optional[str] = None
    matiere: Optional[str] = None
    niveau: Optional[str] = None
    capacite_max: Optional[int] = None
    enseignant_id: Optional[int] = None


class GroupeOut(BaseModel):
    id: int
    centre_id: int
    nom: str
    matiere: Optional[str] = None
    niveau: Optional[str] = None
    capacite_max: int
    enseignant_id: Optional[int] = None
    enseignant_nom: Optional[str] = None
    nombre_eleves: int = 0

    class Config:
        from_attributes = True
