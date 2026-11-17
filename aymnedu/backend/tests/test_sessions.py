import pytest
from datetime import datetime, timedelta
from app.models import RefreshToken, Utilisateur
from app.core.security import decode_token


def test_login_creates_tracked_refresh_token(client, db_session, create_centre_and_user):
    """Vérifie que la connexion génère et enregistre un refresh token tracé avec jti et family_id."""
    centre, user, _ = create_centre_and_user("Ecole Sécurité", "user@secu.dz")

    res = client.post(
        "/api/v1/auth/login",
        json={"email": "user@secu.dz", "password": "password123"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data

    # Vérifier le token en base
    payload = decode_token(data["refresh_token"])
    assert payload is not None
    assert payload["type"] == "refresh"
    assert "jti" in payload
    assert "family" in payload

    db_token = db_session.query(RefreshToken).filter(RefreshToken.jti == payload["jti"]).first()
    assert db_token is not None
    assert db_token.user_id == user.id
    assert db_token.revoked_at is None
    assert db_token.family_id == payload["family"]


def test_refresh_token_rotation_success(client, db_session, create_centre_and_user):
    """Vérifie le fonctionnement de la rotation stricte (RTR) : nouveau token émis, ancien révoqué."""
    _, user, _ = create_centre_and_user("Ecole Rotation", "rot@secu.dz")

    res_login = client.post(
        "/api/v1/auth/login",
        json={"email": "rot@secu.dz", "password": "password123"}
    )
    r1 = res_login.json()["refresh_token"]
    payload1 = decode_token(r1)

    # 1. Utiliser le refresh token r1
    res_ref = client.post("/api/v1/auth/refresh", json={"refresh_token": r1})
    assert res_ref.status_code == 200
    r2 = res_ref.json()["refresh_token"]
    payload2 = decode_token(r2)

    assert r2 != r1
    assert payload2["jti"] != payload1["jti"]
    assert payload2["family"] == payload1["family"]  # Même famille de session

    # Vérifier que r1 est désormais révoqué en base
    t1_db = db_session.query(RefreshToken).filter(RefreshToken.jti == payload1["jti"]).first()
    assert t1_db.revoked_at is not None

    # Vérifier que r2 est actif en base
    t2_db = db_session.query(RefreshToken).filter(RefreshToken.jti == payload2["jti"]).first()
    assert t2_db.revoked_at is None


def test_refresh_token_reuse_detection_revokes_family(client, db_session, create_centre_and_user):
    """
    Vérifie la détection de rejeu / vol de jeton :
    Si un ancien jeton déjà révoqué est réutilisé, toute la famille de session est invalidée immédiatement.
    """
    _, user, _ = create_centre_and_user("Ecole Rejeu", "rejeu@secu.dz")

    res_login = client.post(
        "/api/v1/auth/login",
        json={"email": "rejeu@secu.dz", "password": "password123"}
    )
    r1 = res_login.json()["refresh_token"]

    # Première rotation légitime : r1 -> r2
    res_r2 = client.post("/api/v1/auth/refresh", json={"refresh_token": r1})
    assert res_r2.status_code == 200
    r2 = res_r2.json()["refresh_token"]

    # ATTAQUE / REJEU : Un attaquant rejoue r1 (qui a déjà été consommé)
    res_attack = client.post("/api/v1/auth/refresh", json={"refresh_token": r1})
    assert res_attack.status_code == 401
    assert "réutilisation détectée" in res_attack.json()["detail"].lower()

    # Conséquence : Même le token légitime r2 doit maintenant être révoqué
    res_r3 = client.post("/api/v1/auth/refresh", json={"refresh_token": r2})
    assert res_r3.status_code == 401


def test_logout_revokes_session(client, db_session, create_centre_and_user):
    """Vérifie que l'endpoint /logout révoque le refresh token côté serveur."""
    _, user, _ = create_centre_and_user("Ecole Logout", "logout@secu.dz")

    res_login = client.post(
        "/api/v1/auth/login",
        json={"email": "logout@secu.dz", "password": "password123"}
    )
    token = res_login.json()["refresh_token"]
    payload = decode_token(token)

    # Déconnexion
    res_logout = client.post("/api/v1/auth/logout", json={"refresh_token": token})
    assert res_logout.status_code == 200

    # Vérifier en base
    t_db = db_session.query(RefreshToken).filter(RefreshToken.jti == payload["jti"]).first()
    assert t_db.revoked_at is not None

    # Tenter un refresh après logout -> doit échouer
    res_ref = client.post("/api/v1/auth/refresh", json={"refresh_token": token})
    assert res_ref.status_code == 401


def test_revoke_all_sessions(client, db_session, create_centre_and_user):
    """Vérifie que /revoke-all révoque toutes les sessions actives de l'utilisateur."""
    _, user, headers = create_centre_and_user("Ecole MultiSessions", "multi@secu.dz")

    # Créer 3 sessions (3 logins)
    t1 = client.post("/api/v1/auth/login", json={"email": "multi@secu.dz", "password": "password123"}).json()["refresh_token"]
    t2 = client.post("/api/v1/auth/login", json={"email": "multi@secu.dz", "password": "password123"}).json()["refresh_token"]

    # Révoquer tout
    res_revoke = client.post("/api/v1/auth/revoke-all", headers=headers)
    assert res_revoke.status_code == 200
    assert "session(s) révoquée(s)" in res_revoke.json()["message"]

    # Les deux tokens doivent être rejetés
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": t1}).status_code == 401
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": t2}).status_code == 401

