from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func
from datetime import datetime

from app.models import Eleve, Groupe, Paiement
from app.schemas.dashboard import DashboardStatsOut


def get_dashboard_stats(db: Session, centre_id: int) -> DashboardStatsOut:
    current_month = datetime.utcnow().strftime("%Y-%m")

    total_eleves = db.query(Eleve).filter(Eleve.centre_id == centre_id).count()
    eleves_actifs = db.query(Eleve).filter(Eleve.centre_id == centre_id, Eleve.statut == "actif").count()
    total_groupes = db.query(Groupe).filter(Groupe.centre_id == centre_id).count()

    paiements_mois = db.query(Paiement).filter(
        Paiement.centre_id == centre_id, Paiement.mois == current_month
    ).count()

    montant = db.query(sql_func.sum(Paiement.montant)).filter(
        Paiement.centre_id == centre_id,
        Paiement.statut == "paye",
        Paiement.mois == current_month
    ).scalar() or 0

    return DashboardStatsOut(
        total_eleves=total_eleves,
        eleves_actifs=eleves_actifs,
        total_groupes=total_groupes,
        paiements_du_mois=paiements_mois,
        montant_encaisse=float(montant),
        taux_presence_hebdo=85,
    )
