import pytest
from app.models import PlatformAdmin, Centre, LicenseVoucher
from app.core.security import hash_password


def test_admin_login_and_stats(client, db_session):
    """Vérifie la connexion super-admin et l'accès aux statistiques globales."""
    # Créer un admin
    admin = PlatformAdmin(
        email="superadmin@aymnedu.dz",
        hashed_password=hash_password("adminSecret123"),
        full_name="Directeur Plateforme",
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()

    # 1. Connexion réussie
    res_login = client.post(
        "/api/v1/admin/login",
        json={"email": "superadmin@aymnedu.dz", "password": "adminSecret123"}
    )
    assert res_login.status_code == 200
    data = res_login.json()
    assert "access_token" in data
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Récupérer les stats
    res_stats = client.get("/api/v1/admin/stats", headers=headers)
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert "total_centres" in stats
    assert "active_trials" in stats
    assert "mrr_estime_dzd" in stats


def test_admin_voucher_generation(client, db_session):
    """Vérifie la génération de coupons à usage unique par le Super Admin."""
    admin = PlatformAdmin(
        email="admin@aymnedu.dz",
        hashed_password=hash_password("admin123456"),
        full_name="Admin",
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()

    res_login = client.post(
        "/api/v1/admin/login",
        json={"email": "admin@aymnedu.dz", "password": "admin123456"}
    )
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Générer 2 vouchers
    res_vouchers = client.post(
        "/api/v1/admin/vouchers",
        json={"plan": "pro", "duration_days": 30, "max_eleves": 500, "count": 2, "note": "Campagne promo"},
        headers=headers,
    )
    assert res_vouchers.status_code == 200
    vouchers = res_vouchers.json()
    assert len(vouchers) == 2
    assert vouchers[0]["code"].startswith("AYMN-PRO30-")
    assert vouchers[0]["is_redeemed"] is False

    # Lister les vouchers
    res_list = client.get("/api/v1/admin/vouchers", headers=headers)
    assert res_list.status_code == 200
    assert len(res_list.json()) >= 2


def test_admin_manual_activation_and_toggle(client, db_session, create_centre_and_user):
    """Vérifie la prolongation manuelle d'un centre (ex: virement BaridiMob) et la suspension."""
    centre, _, _ = create_centre_and_user("Ecole El-Manar", "manar@ecole.dz")
    centre.subscription_status = "expired"
    db_session.commit()

    # Login admin
    admin = PlatformAdmin(
        email="admin@aymnedu.dz",
        hashed_password=hash_password("admin123456"),
        full_name="Admin",
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()

    res_login = client.post(
        "/api/v1/admin/login",
        json={"email": "admin@aymnedu.dz", "password": "admin123456"}
    )
    headers = {"Authorization": f"Bearer {res_login.json()['access_token']}"}

    # 1. Prolonger manuellement de 30 jours
    res_act = client.post(
        f"/api/v1/admin/centres/{centre.id}/activate",
        json={"plan": "pro", "duration_days": 30, "max_eleves": 500, "note": "Reçu BaridiMob #123456"},
        headers=headers,
    )
    assert res_act.status_code == 200
    assert res_act.json()["subscription_status"] == "active"

    # 2. Suspendre le centre
    res_toggle = client.post(f"/api/v1/admin/centres/{centre.id}/toggle-status", headers=headers)
    assert res_toggle.status_code == 200
    assert res_toggle.json()["is_active"] is False
    assert res_toggle.json()["subscription_status"] == "suspended"

