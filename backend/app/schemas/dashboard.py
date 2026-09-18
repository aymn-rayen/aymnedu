from pydantic import BaseModel


class DashboardStatsOut(BaseModel):
    total_eleves: int
    eleves_actifs: int
    total_groupes: int
    paiements_du_mois: int
    montant_encaisse: float
    taux_presence_hebdo: int
