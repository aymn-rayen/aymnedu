from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func
from datetime import datetime

from app.models import Eleve, Groupe, Paiement, Presence, PresenceStatutEnum
from app.schemas.dashboard import DashboardStatsOut


def get_dashboard_stats(db: Session, centre_id: int) -> DashboardStatsOut:
    current_month = datetime.utcnow().strftime("%Y-%m")

    # Élèves actifs et non supprimés
    total_eleves = db.query(Eleve).filter(
        Eleve.centre_id == centre_id,
        Eleve.deleted_at == None
    ).count()

    eleves_actifs = db.query(Eleve).filter(
        Eleve.centre_id == centre_id,
        Eleve.statut == "actif",
        Eleve.deleted_at == None
    ).count()

    total_groupes = db.query(Groupe).filter(
        Groupe.centre_id == centre_id,
        Groupe.deleted_at == None
    ).count()

    # Paiements du mois courant
    paiements_mois = db.query(Paiement).filter(
        Paiement.centre_id == centre_id,
        Paiement.mois == current_month
    ).count()

    montant = db.query(sql_func.sum(Paiement.montant)).filter(
        Paiement.centre_id == centre_id,
        Paiement.statut == "paye",
        Paiement.mois == current_month
    ).scalar() or 0

    # Si le mois en cours n'a pas encore d'enregistrements, prendre le dernier mois actif
    if paiements_mois == 0 and float(montant) == 0:
        dernier_paiement = (
            db.query(Paiement.mois)
            .filter(Paiement.centre_id == centre_id)
            .order_by(Paiement.id.desc())
            .first()
        )
        if dernier_paiement and dernier_paiement[0]:
            ref_mois = dernier_paiement[0]
            paiements_mois = db.query(Paiement).filter(
                Paiement.centre_id == centre_id,
                Paiement.mois == ref_mois
            ).count()
            montant = db.query(sql_func.sum(Paiement.montant)).filter(
                Paiement.centre_id == centre_id,
                Paiement.statut == "paye",
                Paiement.mois == ref_mois
            ).scalar() or 0

    # Calcul réel du taux de présence pour le centre
    total_presences = (
        db.query(Presence)
        .join(Groupe, Presence.groupe_id == Groupe.id)
        .filter(Groupe.centre_id == centre_id)
        .count()
    )

    if total_presences > 0:
        total_presents = (
            db.query(Presence)
            .join(Groupe, Presence.groupe_id == Groupe.id)
            .filter(
                Groupe.centre_id == centre_id,
                Presence.statut == PresenceStatutEnum.present
            )
            .count()
        )
        taux_presence = round((total_presents / total_presences) * 100)
    else:
        taux_presence = 100

    return DashboardStatsOut(
        total_eleves=total_eleves,
        eleves_actifs=eleves_actifs,
        total_groupes=total_groupes,
        paiements_du_mois=paiements_mois,
        montant_encaisse=float(montant),
        taux_presence_hebdo=taux_presence,
    )
