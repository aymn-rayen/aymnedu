import pytest
from app.models import Utilisateur, Centre, RoleEnum
from app.core.security import hash_password


def test_login_success(client, create_centre_and_user):
    centre, user, _ = create_centre_and_user("Ecole Al-Nadjah", "directeur@al-nadjah.dz")

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "directeur@al-nadjah.dz", "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client, create_centre_and_user):
    create_centre_and_user("Ecole Al-Nadjah", "directeur@al-nadjah.dz")

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "directeur@al-nadjah.dz", "password": "wrong-password"}
    )
    assert response.status_code == 401
    assert "Identifiants incorrects" in response.json()["detail"]


def test_login_unknown_email(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@test.com", "password": "password123"}
    )
    assert response.status_code == 401


def test_register_success(client):
    payload = {
        "nom_centre": "Nouveau Centre Pilote",
        "wilaya": "16 - Alger",
        "telephone": "0550112233",
        "full_name": "Karim Directeur",
        "email": "karim@pilote.dz",
        "password": "strongpassword123",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_register_duplicate_email(client, create_centre_and_user):
    create_centre_and_user("Centre 1", "directeur@existing.dz")

    payload = {
        "nom_centre": "Autre Centre",
        "wilaya": "31 - Oran",
        "full_name": "Autre Directeur",
        "email": "directeur@existing.dz",
        "password": "password1234",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "existe déjà" in response.json()["detail"]


def test_register_password_too_short(client):
    payload = {
        "nom_centre": "Centre Test",
        "wilaya": "16 - Alger",
        "full_name": "Test User",
        "email": "test@centre.dz",
        "password": "123",  # Less than 8 characters
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422  # Validation error from Pydantic


def test_auth_me_success(client, create_centre_and_user):
    _, user, headers = create_centre_and_user("Centre A", "admin@centre-a.dz")

    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "admin@centre-a.dz"
    assert data["role"] == "directeur"


def test_auth_me_invalid_token(client):
    headers = {"Authorization": "Bearer invalid.token.value"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 401
