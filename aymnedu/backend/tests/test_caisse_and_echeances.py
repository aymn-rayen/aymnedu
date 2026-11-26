from decimal import Decimal
from datetime import datetime, timezone
from app.models import Eleve, Groupe, InscriptionGroupe, Paiement, PaiementStatutEnum, Versement


def test_generer_echeances_mensuelles_idempotence(client, db_session, create_centre_and_user):
    centre, user, headers = create_centre_and_user("Centre Echeances", "directeur@echeances.dz", role="directeur")

    # Création de 2 élèves et 2 groupes avec tarifs différents
    e1 = Eleve(centre_id=centre.id, prenom="Yanis", nom="Hamidi", niveau="3AS", statut="actif")
    e2 = Eleve(centre_id=centre.id, prenom="Lina", nom="Belkacem", niveau="3AS", statut="actif")
    g1 = Groupe(centre_id=centre.id, nom="Maths 3AS", niveau="3AS", tarif=Decimal("3000.00"), capacite_max=25)
    g2 = Groupe(centre_id=centre.id, nom="Physique 3AS", niveau="3AS", tarif=Decimal("2500.00"), capacite_max=25)
    db_session.add_all([e1, e2, g1, g2])
    db_session.commit()

    # Inscriptions : e1 -> g1 et g2; e2 -> g1 uniquement
    db_session.add_all([
        InscriptionGroupe(eleve_id=e1.id, groupe_id=g1.id),
        InscriptionGroupe(eleve_id=e1.id, groupe_id=g2.id),
        InscriptionGroupe(eleve_id=e2.id, groupe_id=g1.id),
    ])
    db_session.commit()

    # 1ère génération pour le mois 2026-12
    res1 = client.post("/api/v1/paiements/generer-mois", json={"mois": "2026-12"}, headers=headers)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["creances_creees"] == 3
    assert data1["deja_existantes"] == 0
    assert data1["montant_total_nouveau"] == 8500.0  # 3000 + 2500 + 3000

    # 2ème génération immédiate (Test de l'Idempotence stricte : 0 doublon créé)
    res2 = client.post("/api/v1/paiements/generer-mois", json={"mois": "2026-12"}, headers=headers)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["creances_creees"] == 0
    assert data2["deja_existantes"] == 3
    assert data2["montant_total_nouveau"] == 0.0

    # Vérification en base : exactement 3 lignes de paiement pour 2026-12
    lignes = db_session.query(Paiement).filter(Paiement.centre_id == centre.id, Paiement.mois == "2026-12").all()
    assert len(lignes) == 3


def test_cloture_caisse_workflow_3_etats(client, db_session, create_centre_and_user):
    centre, dir_user, dir_headers = create_centre_and_user("Centre Caisse", "dir@caisse.dz", role="directeur")
    # Secrétaire
    from app.models import Utilisateur, RoleEnum
    from app.core.security import hash_password
    sec_user = Utilisateur(
        centre_id=centre.id,
        email="sec@caisse.dz",
        hashed_password=hash_password("Secret123!"),
        full_name="Fatima Secrétaire",
        role=RoleEnum.secretaire,
    )
    db_session.add(sec_user)
    db_session.commit()

    from app.core.security import create_access_token
    sec_token = create_access_token(data={"sub": str(sec_user.id), "centre_id": centre.id, "role": "secretaire"})
    sec_headers = {"Authorization": f"Bearer {sec_token}"}

    # Création d'un élève, groupe et encaissements du jour
    eleve = Eleve(centre_id=centre.id, prenom="Mehdi", nom="Larbi", niveau="1AS")
    groupe = Groupe(centre_id=centre.id, nom="Sciences 1AS", tarif=Decimal("4000.00"))
    db_session.add_all([eleve, groupe])
    db_session.commit()

    now_utc = datetime.now(timezone.utc)
    today_str = now_utc.strftime("%Y-%m-%d")

    # Paiement 1 : 2500 DA en espèces
    p1 = Paiement(centre_id=centre.id, eleve_id=eleve.id, groupe_id=groupe.id, montant=Decimal("4000.00"), montant_verse=Decimal("2500.00"), mois="2026-11", statut=PaiementStatutEnum.partiel)
    db_session.add(p1)
    db_session.flush()

    v1 = Versement(paiement_id=p1.id, centre_id=centre.id, recu_par_user_id=sec_user.id, montant=Decimal("2500.00"), mode_reglement="especes", recu_numero="REC-TEST-ESP-1", date_versement=now_utc)
    # Paiement 2 : 1500 DA en baridimob
    v2 = Versement(paiement_id=p1.id, centre_id=centre.id, recu_par_user_id=sec_user.id, montant=Decimal("1500.00"), mode_reglement="baridimob", recu_numero="REC-TEST-BAR-2", date_versement=now_utc)
    db_session.add_all([v1, v2])
    db_session.commit()

    # 1. ÉTAT 1 : Caisse OUVERTE
    res_get = client.get(f"/api/v1/caisse/jour?date_cloture={today_str}", headers=sec_headers)
    assert res_get.status_code == 200
    c_data = res_get.json()
    assert c_data["statut"] == "ouverte"
    assert c_data["total_especes_theorique"] == 2500.0
    assert c_data["total_baridimob_theorique"] == 1500.0
    assert c_data["total_theorique"] == 4000.0
    assert c_data["nb_versements"] == 2
    assert len(c_data["versements"]) == 2

    # 2. ÉTAT 2 : La secrétaire ferme la caisse (EN_ATTENTE_VALIDATION) avec recomptage physique
    # Elle recompte 2500 DA dans le tiroir (écart = 0)
    res_close = client.post(
        "/api/v1/caisse/fermer",
        json={"date_cloture": today_str, "total_especes_reel": 2500.0, "notes": "Caisse parfaitement équilibrée"},
        headers=sec_headers
    )
    assert res_close.status_code == 200
    close_data = res_close.json()
    assert close_data["statut"] == "en_attente_validation"
    assert close_data["total_especes_reel"] == 2500.0
    assert close_data["ecart"] == 0.0
    assert close_data["ferme_par_nom"] == "Fatima Secrétaire"

    # La secrétaire ne PEUT PAS valider (interdit 403)
    res_sec_val = client.post("/api/v1/caisse/valider", json={"date_cloture": today_str}, headers=sec_headers)
    assert res_sec_val.status_code == 403

    # 3. ÉTAT 3 : Le directeur valide la caisse (VALIDEE)
    res_dir_val = client.post("/api/v1/caisse/valider", json={"date_cloture": today_str}, headers=dir_headers)
    assert res_dir_val.status_code == 200
    val_data = res_dir_val.json()
    assert val_data["statut"] == "validee"
    assert val_data["valide_par_nom"] is not None
