import pytest
from app.models import Eleve, Groupe, Paiement, PaiementStatutEnum


def test_tenant_isolation_eleves(client, db_session, create_centre_and_user):
    # Setup Centre A and Centre B
    centre_a, user_a, headers_a = create_centre_and_user("Centre A", "dir_a@ecole.dz")
    centre_b, user_b, headers_b = create_centre_and_user("Centre B", "dir_b@ecole.dz")

    # Create Eleve in Centre A
    eleve_a = Eleve(centre_id=centre_a.id, prenom="Amine", nom="Algerois", niveau="1AS")
    db_session.add(eleve_a)

    # Create Eleve in Centre B
    eleve_b = Eleve(centre_id=centre_b.id, prenom="Billel", nom="Oranais", niveau="2AS")
    db_session.add(eleve_b)
    db_session.commit()

    # User A lists eleves -> Should only see Amine
    res_a = client.get("/api/v1/eleves", headers=headers_a)
    assert res_a.status_code == 200
    items_a = res_a.json()["items"]
    ids_a = [e["id"] for e in items_a]
    assert eleve_a.id in ids_a
    assert eleve_b.id not in ids_a

    # User A tries to get Eleve B directly by ID -> Must receive 404
    res_direct = client.get(f"/api/v1/eleves/{eleve_b.id}", headers=headers_a)
    assert res_direct.status_code == 404

    # User A tries to update Eleve B -> Must receive 404
    res_update = client.put(f"/api/v1/eleves/{eleve_b.id}", json={"prenom": "Hack", "nom": "Attempt"}, headers=headers_a)
    assert res_update.status_code == 404

    # User A tries to delete Eleve B -> Must receive 404
    res_delete = client.delete(f"/api/v1/eleves/{eleve_b.id}", headers=headers_a)
    assert res_delete.status_code == 404


def test_tenant_isolation_groupes(client, db_session, create_centre_and_user):
    centre_a, user_a, headers_a = create_centre_and_user("Centre A", "dir_a_grp@ecole.dz")
    centre_b, user_b, headers_b = create_centre_and_user("Centre B", "dir_b_grp@ecole.dz")

    # Create Groupes
    grp_a = Groupe(centre_id=centre_a.id, nom="Groupe Math A", matiere="Mathématiques")
    grp_b = Groupe(centre_id=centre_b.id, nom="Groupe Physique B", matiere="Physique")
    db_session.add_all([grp_a, grp_b])
    db_session.commit()

    # User A lists groupes -> Should only see grp_a
    res = client.get("/api/v1/groupes", headers=headers_a)
    assert res.status_code == 200
    grp_ids = [g["id"] for g in res.json()]
    assert grp_a.id in grp_ids
    assert grp_b.id not in grp_ids

    # User A tries to get Group B by ID -> 404
    res_b = client.get(f"/api/v1/groupes/{grp_b.id}", headers=headers_a)
    assert res_b.status_code == 404

    # User A tries to delete Group B -> 404
    res_del = client.delete(f"/api/v1/groupes/{grp_b.id}", headers=headers_a)
    assert res_del.status_code == 404


def test_tenant_isolation_paiements(client, db_session, create_centre_and_user):
    centre_a, user_a, headers_a = create_centre_and_user("Centre A", "dir_a_pay@ecole.dz")
    centre_b, user_b, headers_b = create_centre_and_user("Centre B", "dir_b_pay@ecole.dz")

    eleve_b = Eleve(centre_id=centre_b.id, prenom="Billel", nom="Oranais")
    grp_b = Groupe(centre_id=centre_b.id, nom="Groupe B")
    db_session.add_all([eleve_b, grp_b])
    db_session.flush()

    paiement_b = Paiement(
        centre_id=centre_b.id,
        eleve_id=eleve_b.id,
        groupe_id=grp_b.id,
        montant=3500.0,
        mois="2026-10",
        statut=PaiementStatutEnum.impaye,
    )
    db_session.add(paiement_b)
    db_session.commit()

    # User A lists paiements -> Must be empty
    res = client.get("/api/v1/paiements", headers=headers_a)
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 0

    # User A tries to mark paiement B as paid -> 404
    res_pay = client.patch(f"/api/v1/paiements/{paiement_b.id}/payer", headers=headers_a)
    assert res_pay.status_code == 404
