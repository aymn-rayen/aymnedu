from decimal import Decimal
from app.models import Eleve, Groupe, Paiement, Versement, InscriptionGroupe


def test_inscription_complete_sans_encaissement(client, db_session, create_centre_and_user):
    centre, user, headers = create_centre_and_user("Centre Inscription 1", "dir@inscr1.dz")

    g1 = Groupe(centre_id=centre.id, nom="Maths 3AS", niveau="3AS", tarif=Decimal("2500.00"), capacite_max=20)
    g2 = Groupe(centre_id=centre.id, nom="Physique 3AS", niveau="3AS", tarif=Decimal("3000.00"), capacite_max=20)
    db_session.add_all([g1, g2])
    db_session.commit()

    payload = {
        "prenom": "Ramy",
        "nom": "Bensebaini",
        "telephone_responsable": "0550112233",
        "niveau": "3AS",
        "groupe_ids": [g1.id, g2.id],
        "encaisser_maintenant": False,
        "mois": "2026-11",
    }
    res = client.post("/api/v1/eleves/inscription-complete", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["eleve"]["prenom"] == "Ramy"
    assert data["eleve"]["nom"] == "Bensebaini"
    assert len(data["groupes_inscrits"]) == 2
    assert data["total_tarif"] == 5500.0
    assert data["total_verse"] == 0.0
    assert data["reste_a_payer"] == 5500.0
    assert data["recu_numero"] is None

    # Check database state
    eleve_id = data["eleve"]["id"]
    inscriptions = db_session.query(InscriptionGroupe).filter(InscriptionGroupe.eleve_id == eleve_id).all()
    assert len(inscriptions) == 2

    paiements = db_session.query(Paiement).filter(Paiement.eleve_id == eleve_id).all()
    assert len(paiements) == 2
    for p in paiements:
        assert p.statut.value == "impaye"
        assert p.montant_verse == Decimal("0.00")
        assert p.montant in (Decimal("2500.00"), Decimal("3000.00"))


def test_inscription_complete_avec_encaissement_direct(client, db_session, create_centre_and_user):
    centre, user, headers = create_centre_and_user("Centre Inscription 2", "sec@inscr2.dz")

    g1 = Groupe(centre_id=centre.id, nom="Français BEM", niveau="4AM", tarif=Decimal("2000.00"), capacite_max=15)
    g2 = Groupe(centre_id=centre.id, nom="Arabe BEM", niveau="4AM", tarif=Decimal("1800.00"), capacite_max=15)
    db_session.add_all([g1, g2])
    db_session.commit()

    payload = {
        "prenom": "Sarah",
        "nom": "Meziane",
        "telephone_responsable": "0661998877",
        "niveau": "4AM",
        "groupe_ids": [g1.id, g2.id],
        "encaisser_maintenant": True,
        "montant_verse": 3800.0,
        "mode_reglement": "especes",
        "mois": "2026-11",
    }
    res = client.post("/api/v1/eleves/inscription-complete", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["eleve"]["prenom"] == "Sarah"
    assert data["total_tarif"] == 3800.0
    assert data["total_verse"] == 3800.0
    assert data["reste_a_payer"] == 0.0
    assert data["recu_numero"] is not None
    assert "REC-" in data["recu_numero"]

    # Verify payments and versements in DB
    eleve_id = data["eleve"]["id"]
    paiements = db_session.query(Paiement).filter(Paiement.eleve_id == eleve_id).all()
    assert len(paiements) == 2
    for p in paiements:
        assert p.statut.value == "paye"
        assert p.montant_verse == p.montant

    versements = db_session.query(Versement).filter(Versement.centre_id == centre.id).all()
    assert len(versements) == 2
    for v in versements:
        assert v.recu_par_user_id == user.id
        assert v.mode_reglement == "especes"
        assert "REC-" in v.recu_numero
