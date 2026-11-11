import pytest
from app.models import Eleve, Groupe, Paiement, PaiementStatutEnum


def test_create_and_mark_paiement(client, db_session, create_centre_and_user):
    centre, user, headers = create_centre_and_user("Centre Paiement", "directeur@paiement.dz")

    # Create Eleve and Groupe
    eleve = Eleve(centre_id=centre.id, prenom="Yacine", nom="Brahimi", niveau="1AS")
    groupe = Groupe(centre_id=centre.id, nom="Mathématiques 1AS")
    db_session.add_all([eleve, groupe])
    db_session.commit()

    # Create Paiement
    payload = {
        "eleve_id": eleve.id,
        "groupe_id": groupe.id,
        "montant": 4000.0,
        "mois": "2026-10",
    }
    res_create = client.post("/api/v1/paiements", json=payload, headers=headers)
    assert res_create.status_code == 201
    p_data = res_create.json()
    assert p_data["montant"] == 4000.0
    assert p_data["statut"] == "impaye"
    assert p_data["eleve_nom"] == "Yacine Brahimi"

    # Mark as paid
    paiement_id = p_data["id"]
    res_paid = client.patch(f"/api/v1/paiements/{paiement_id}/payer", headers=headers)
    assert res_paid.status_code == 200
    paid_data = res_paid.json()
    assert paid_data["statut"] == "paye"
    assert paid_data["recu_numero"] is not None
    assert "REC-" in paid_data["recu_numero"]


def test_create_paiement_nonexistent_eleve(client, db_session, create_centre_and_user):
    centre, user, headers = create_centre_and_user("Centre Paiement 2", "dir@paiement2.dz")
    groupe = Groupe(centre_id=centre.id, nom="Physique 2AS")
    db_session.add(groupe)
    db_session.commit()

    payload = {
        "eleve_id": 99999,
        "groupe_id": groupe.id,
        "montant": 3000.0,
        "mois": "2026-10",
    }
    res = client.post("/api/v1/paiements", json=payload, headers=headers)
    assert res.status_code == 404
    assert "Élève non trouvé" in res.json()["detail"]
