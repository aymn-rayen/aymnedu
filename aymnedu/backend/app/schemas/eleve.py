from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import date as date_type
from decimal import Decimal


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
    model_config = ConfigDict(from_attributes=True)
    id: int
    centre_id: int
    date_inscription: Optional[date_type] = None
    statut: str


# ── Quick Cashier / Fast Search Schema ──────────────────────────────────────
class EleveGroupeSummary(BaseModel):
    id: int
    nom: str
    matiere: Optional[str] = None
    niveau: Optional[str] = None


class EleveUnpaidPaiement(BaseModel):
    id: int
    groupe_id: int
    groupe_nom: str
    mois: str
    montant: float
    montant_verse: float
    reste: float
    statut: str


class EleveQuickSummary(BaseModel):
    id: int
    prenom: str
    nom: str
    niveau: Optional[str] = None
    telephone_responsable: Optional[str] = None
    statut: str
    groupes: List[EleveGroupeSummary] = []
    total_reste_du: float = 0.0
    impayes: List[EleveUnpaidPaiement] = []


# ── Inscription Tout-en-Un Schema ──────────────────────────────────────────
class EleveInscriptionCompleteRequest(BaseModel):
    prenom: str
    nom: str
    telephone_responsable: Optional[str] = None
    niveau: Optional[str] = None
    groupe_ids: List[int] = []
    encaisser_maintenant: bool = False
    montant_verse: Optional[Decimal] = None
    mode_reglement: Optional[str] = "especes"
    mois: Optional[str] = None


class EleveInscriptionCompleteOut(BaseModel):
    eleve: EleveOut
    groupes_inscrits: List[EleveGroupeSummary] = []
    total_tarif: float
    total_verse: float
    reste_a_payer: float
    recu_numero: Optional[str] = None

