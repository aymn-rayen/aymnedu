from pydantic import BaseModel, field_serializer
from typing import Optional
from datetime import time as time_type


class SeanceBase(BaseModel):
    groupe_id: int
    salle: Optional[str] = None
    enseignant_id: Optional[int] = None
    jour_semaine: str
    heure_debut: str
    heure_fin: str


class SeanceCreate(SeanceBase):
    pass


class SeanceUpdate(BaseModel):
    groupe_id: Optional[int] = None
    salle: Optional[str] = None
    enseignant_id: Optional[int] = None
    jour_semaine: Optional[str] = None
    heure_debut: Optional[str] = None
    heure_fin: Optional[str] = None


class SeanceOut(BaseModel):
    id: int
    groupe_id: int
    salle: Optional[str] = None
    enseignant_id: Optional[int] = None
    enseignant_nom: Optional[str] = None
    groupe_nom: Optional[str] = None
    jour_semaine: str
    heure_debut: str | time_type
    heure_fin: str | time_type

    class Config:
        from_attributes = True

    @field_serializer("heure_debut", "heure_fin")
    def serialize_time(self, v):
        return str(v) if v is not None else ""
