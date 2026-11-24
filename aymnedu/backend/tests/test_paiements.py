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


def test_quick_search_cashier_endpoint(client, db_session, create_centre_and_user):
    centre, user, headers = create_centre_and_user("Centre Cashier", "directeur@cashier.dz")

    # Create Eleve, Groupe, and Paiement (impayé)
    eleve = Eleve(centre_id=centre.id, prenom="Amine", nom="Haddad", niveau="4AM", telephone_responsable="0550112233")
    groupe = Groupe(centre_id=centre.id, nom="Physique BEM", matiere="Physique")
    db_session.add_all([eleve, groupe])
    db_session.commit()

    # Link inscription
    from app.models import InscriptionGroupe
    db_session.add(InscriptionGroupe(eleve_id=eleve.id, groupe_id=groupe.id))

    # Add unpaid payment
    paiement = Paiement(
        centre_id=centre.id,
        eleve_id=eleve.id,
        groupe_id=groupe.id,
        montant=3500.0,
        montant_verse=2000.0,
        mois="2026-11",
        statut=PaiementStatutEnum.partiel
    )
    db_session.add(paiement)
    db_session.commit()

    # Search by "Amine"
    res = client.get("/api/v1/eleves/quick-search?q=Amine", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    found = data[0]
    assert found["prenom"] == "Amine"
    assert found["nom"] == "Haddad"
    assert found["total_reste_du"] == 1500.0
    assert len(found["impayes"]) == 1
    assert found["impayes"][0]["reste"] == 1500.0
    assert found["impayes"][0]["groupe_nom"] == "Physique BEM"


def test_versement_partiel_et_complet_audit(client, db_session, create_centre_and_user):
    from decimal import Decimal
    from app.models import Versement
    centre, user, headers = create_centre_and_user("Centre Versement", "caisse@centre.dz")

    eleve = Eleve(centre_id=centre.id, prenom="Karim", nom="Benzema", niveau="2AS")
    groupe = Groupe(centre_id=centre.id, nom="Français 2AS")
    db_session.add_all([eleve, groupe])
    db_session.commit()

    # Create payment of 3000.00
    res_create = client.post(
        "/api/v1/paiements",
        json={"eleve_id": eleve.id, "groupe_id": groupe.id, "montant": 3000.0, "mois": "2026-11"},
        headers=headers,
    )
    assert res_create.status_code == 201
    p_id = res_create.json()["id"]

    # 1er versement : 1000 DA (espèces)
    res_v1 = client.patch(
        f"/api/v1/paiements/{p_id}/verser",
        json={"montant": 1000.0, "mode_reglement": "especes"},
        headers=headers,
    )
    assert res_v1.status_code == 200
    v1_data = res_v1.json()
    assert v1_data["statut"] == "partiel"
    assert v1_data["montant_verse"] == 1000.0
    assert len(v1_data["versements"]) == 1
    recu1 = v1_data["versements"][0]["recu_numero"]
    assert "REC-" in recu1

    # Check database record for Versement
    v_rows = db_session.query(Versement).filter(Versement.paiement_id == p_id).all()
    assert len(v_rows) == 1
    assert v_rows[0].montant == Decimal("1000.00")
    assert v_rows[0].recu_par_user_id == user.id
    assert v_rows[0].centre_id == centre.id

    # 2eme versement : tentative de trop payer (2500 DA alors qu'il reste 2000 DA) -> 422 Unprocessable Entity
    res_trop = client.patch(
        f"/api/v1/paiements/{p_id}/verser",
        json={"montant": 2500.0, "mode_reglement": "especes"},
        headers=headers,
    )
    assert res_trop.status_code == 422
    assert "dépasse le solde restant" in res_trop.json()["detail"]

    # 2eme versement valide : solde de 2000 DA (baridimob) -> statut payé
    res_v2 = client.patch(
        f"/api/v1/paiements/{p_id}/verser",
        json={"montant": 2000.0, "mode_reglement": "baridimob"},
        headers=headers,
    )
    assert res_v2.status_code == 200
    v2_data = res_v2.json()
    assert v2_data["statut"] == "paye"
    assert v2_data["montant_verse"] == 3000.0
    assert len(v2_data["versements"]) == 2

