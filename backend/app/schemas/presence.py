from pydantic import BaseModel
from typing import Optional
from datetime import date as date_type


class PresenceIn(BaseModel):
    eleve_id: int
    groupe_id: int
    date_seance: date_type
    statut: str = "present"
    minutes_retard: int = 0


class PresenceOut(BaseModel):
    id: Optional[int] = None
    eleve_id: int
    groupe_id: int
    date_seance: date_type
    statut: str
    minutes_retard: int = 0
    eleve_nom: Optional[str] = None

    class Config:
        from_attributes = True
