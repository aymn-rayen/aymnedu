from datetime import datetime, timedelta
import pytest
from app.models import Centre, Utilisateur, RoleEnum, Eleve, Groupe
from app.services.subscription_service import get_subscription_info, activate_subscription_code


def test_new_centre_starts_in_14_day_trial(client, db_session):
    """Vérifie qu'un nouveau centre s'inscrit avec 14 jours d'essai et quota de 50 élèves."""
    payload = {
        "nom_centre": "Centre Essai 14j",
        "wilaya": "16 - Alger",
        "telephone": "0550998877",
        "full_name": "Directeur Essai",
        "email": "dir@essai14.dz",
        "password": "password123",
    }
    res = client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 200

    centre = db_session.query(Centre).filter(Centre.nom == "Centre Essai 14j").first()
    assert centre is not None
    assert centre.subscription_status == "trial"
    assert centre.subscription_plan == "starter"
    assert centre.max_eleves == 50
    assert centre.trial_ends_at is not None

    delta = centre.trial_ends_at - datetime.now()
    assert 13 <= delta.days <= 14


def test_expired_trial_blocks_writes_with_402(client, db_session, create_centre_and_user):
    """Vérifie qu'un centre dont l'essai a expiré est bloqué en écriture avec HTTP 402."""
    centre, user, headers = create_centre_and_user("Centre Expiré", "dir@expire.dz")

    # Forcer la date d'essai dans le passé
    centre.subscription_status = "trial"
    centre.trial_ends_at = datetime.now() - timedelta(days=2)
    db_session.commit()

    # 1. Tenter de créer un élève -> doit échouer en 402
    res_eleve = client.post(
        "/api/v1/eleves",
        json={"prenom": "Ali", "nom": "Benali", "niveau": "1AS"},
        headers=headers,
    )
    assert res_eleve.status_code == 402
    assert "expiré" in res_eleve.json()["detail"]

    # 2. Tenter de créer un groupe -> doit échouer en 402
    res_groupe = client.post(
        "/api/v1/groupes",
        json={"nom": "Mathématiques Terminale", "matiere": "Maths", "capacite_max": 20},
        headers=headers,
    )
    assert res_groupe.status_code == 402

    # 3. GET subscription doit indiquer is_expired: True
    res_sub = client.get("/api/v1/subscription", headers=headers)
    assert res_sub.status_code == 200
    sub_data = res_sub.json()
    assert sub_data["is_expired"] is True
    assert sub_data["can_write"] is False
    assert sub_data["days_remaining"] == 0


def test_activate_subscription_restores_write_access(client, db_session, create_centre_and_user):
    """Vérifie que l'activation d'un code de licence débloque immédiatement le centre."""
    centre, user, headers = create_centre_and_user("Centre A Débloquer", "dir@debloquer.dz")

    # Expirer le centre
    centre.subscription_status = "expired"
    centre.trial_ends_at = datetime.now() - timedelta(days=5)
    db_session.commit()

    # Activer le forfait Pro 1 mois
    res_act = client.post(
        "/api/v1/subscription/activate",
        json={"code": "AYMN-PRO-1MOIS"},
        headers=headers,
    )
    assert res_act.status_code == 200
    act_data = res_act.json()
    assert act_data["subscription_status"] == "active"
    assert act_data["subscription_plan"] == "pro"
    assert act_data["is_expired"] is False
    assert act_data["can_write"] is True
    assert act_data["max_eleves"] == 500
    assert act_data["days_remaining"] >= 29

    # Vérifier que l'écriture d'élève refonctionne immédiatement
    res_eleve = client.post(
        "/api/v1/eleves",
        json={"prenom": "Nassim", "nom": "Saidi", "niveau": "4AM"},
        headers=headers,
    )
    assert res_eleve.status_code == 201


def test_quota_max_eleves_enforced(client, db_session, create_centre_and_user):
    """Vérifie que la limite max_eleves bloque l'inscription au-delà du quota."""
    centre, user, headers = create_centre_and_user("Centre Quota", "dir@quota.dz")
    centre.subscription_status = "trial"
    centre.trial_ends_at = datetime.now() + timedelta(days=10)
    centre.max_eleves = 2  # Quota strict de 2 élèves
    db_session.commit()

    # Inscrire 2 élèves (autorisé)
    client.post("/api/v1/eleves", json={"prenom": "E1", "nom": "N1"}, headers=headers)
    client.post("/api/v1/eleves", json={"prenom": "E2", "nom": "N2"}, headers=headers)

    # Inscrire le 3ème élève (doit échouer avec HTTP 400 Quota)
    res_third = client.post("/api/v1/eleves", json={"prenom": "E3", "nom": "N3"}, headers=headers)
    assert res_third.status_code == 400
    assert "Limite maximale d'élèves atteinte" in res_third.json()["detail"]


def test_payment_instructions_endpoint(client, create_centre_and_user):
    """Vérifie que l'endpoint /subscription/instructions renvoie bien les coordonnées BaridiMob/CCP."""
    _, _, headers = create_centre_and_user("Centre Instructions", "dir@instructions.dz")
    res = client.get("/api/v1/subscription/instructions", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "baridimob_rip" in data
    assert "ccp_compte" in data
    assert "00799999002345678945" in data["baridimob_rip"]
    assert "4500" in str(data["montant_mensuel_dzd"])
