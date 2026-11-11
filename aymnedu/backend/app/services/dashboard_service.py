from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func, case
from datetime import datetime, timedelta, timezone

from app.models import Eleve, Groupe, Paiement, Presence, PresenceStatutEnum
from app.schemas.dashboard import DashboardStatsOut


def get_dashboard_stats(db: Session, centre_id: int) -> DashboardStatsOut:
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")

    # ── Élèves ────────────────────────────────────────────────────────────────
    total_eleves = db.query(Eleve).filter(
        Eleve.centre_id == centre_id,
        Eleve.deleted_at == None
    ).count()

    eleves_actifs = db.query(Eleve).filter(
        Eleve.centre_id == centre_id,
        Eleve.statut == "actif",
        Eleve.deleted_at == None
    ).count()

    # ── Groupes ───────────────────────────────────────────────────────────────
    total_groupes = db.query(Groupe).filter(
        Groupe.centre_id == centre_id,
        Groupe.deleted_at == None
    ).count()

    # ── Paiements du mois courant ─────────────────────────────────────────────
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

    # ── Impayés du mois courant ───────────────────────────────────────────────
    impayes_du_mois = db.query(Paiement).filter(
        Paiement.centre_id == centre_id,
        Paiement.statut == "impaye",
        Paiement.mois == current_month
    ).count()

    # ── Taux de présence réel des 7 derniers jours ────────────────────────────
    # Calcul SQL en une seule requête avec COUNT + CASE pour éviter 2 aller-retours.
    # On filtre sur les groupes du centre (via JOIN) et la fenêtre de 7 jours.
    today = datetime.now(timezone.utc).date()
    seven_days_ago = today - timedelta(days=7)

    weekly = (
        db.query(
            sql_func.count(Presence.id).label("total"),
            sql_func.sum(
                case((Presence.statut == PresenceStatutEnum.present, 1), else_=0)
            ).label("presents"),
        )
        .join(Groupe, Presence.groupe_id == Groupe.id)
        .filter(
            Groupe.centre_id == centre_id,
            Presence.date_seance >= seven_days_ago,
            Presence.date_seance <= today,
        )
        .one()
    )

    total_w = weekly.total or 0
    presents_w = int(weekly.presents or 0)

    if total_w > 0:
        taux_presence = round((presents_w / total_w) * 100)
    else:
        # Fallback: taux global (all-time) si aucune donnée cette semaine
        all_time = (
            db.query(
                sql_func.count(Presence.id).label("total"),
                sql_func.sum(
                    case((Presence.statut == PresenceStatutEnum.present, 1), else_=0)
                ).label("presents"),
            )
            .join(Groupe, Presence.groupe_id == Groupe.id)
            .filter(Groupe.centre_id == centre_id)
            .one()
        )
        if (all_time.total or 0) > 0:
            taux_presence = round((int(all_time.presents or 0) / all_time.total) * 100)
        else:
            taux_presence = 100  # Pas encore de données → 100 % par défaut

    return DashboardStatsOut(
        total_eleves=total_eleves,
        eleves_actifs=eleves_actifs,
        total_groupes=total_groupes,
        paiements_du_mois=paiements_mois,
        montant_encaisse=float(montant),
        impayes_du_mois=impayes_du_mois,
        taux_presence_hebdo=taux_presence,
    )
