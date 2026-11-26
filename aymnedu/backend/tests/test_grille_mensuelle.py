from datetime import date, time
from decimal import Decimal
from app.models import Eleve, Groupe, InscriptionGroupe, Seance, Presence, PresenceStatutEnum


def test_grille_mensuelle_with_seances_and_presences(client, db_session, create_centre_and_user):
    centre, user, headers = create_centre_and_user("Centre Presences", "directeur@presences.dz", role="directeur")
    g = Groupe(centre_id=centre.id, nom="Maths 3AS Grille", niveau="3AS", tarif=Decimal("2500.00"), capacite_max=20)
    db_session.add(g)
    db_session.commit()

    s1 = Seance(
        centre_id=centre.id,
        groupe_id=g.id,
        jour_semaine="samedi",
        salle="Salle 1",
        heure_debut=time(10, 0),
        heure_fin=time(12, 0),
    )
    s2 = Seance(
        centre_id=centre.id,
        groupe_id=g.id,
        jour_semaine="mardi",
        salle="Salle 1",
        heure_debut=time(14, 0),
        heure_fin=time(16, 0),
    )
    db_session.add_all([s1, s2])

    e1 = Eleve(centre_id=centre.id, prenom="Amine", nom="Brahimi", niveau="3AS", statut="actif")
    e2 = Eleve(centre_id=centre.id, prenom="Sara", nom="Kaci", niveau="3AS", statut="actif")
    db_session.add_all([e1, e2])
    db_session.commit()

    db_session.add_all([
        InscriptionGroupe(eleve_id=e1.id, groupe_id=g.id),
        InscriptionGroupe(eleve_id=e2.id, groupe_id=g.id),
    ])
    db_session.commit()

    d1 = date(2026, 11, 7)
    p1 = Presence(groupe_id=g.id, eleve_id=e1.id, date_seance=d1, statut=PresenceStatutEnum.present)
    p2 = Presence(groupe_id=g.id, eleve_id=e2.id, date_seance=d1, statut=PresenceStatutEnum.absent)
    db_session.add_all([p1, p2])
    db_session.commit()

    res = client.get(f"/api/v1/presences/grille-mensuelle?groupe_id={g.id}&mois=2026-11", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["groupe_id"] == g.id
    assert data["mois"] == "2026-11"
    assert data["total_eleves"] == 2
    # Les dates calculées (tous les mardis et samedis de novembre 2026) doivent contenir 2026-11-07
    assert "2026-11-07" in data["dates"]
    assert len(data["dates"]) >= 8  # En novembre 2026, il y a 4 samedis et 4 mardis

    # Vérification des élèves
    eleves = {elv["eleve_id"]: elv for elv in data["eleves"]}
    assert e1.id in eleves
    assert e2.id in eleves

    # e1 était présent le 07/11
    assert eleves[e1.id]["seances"]["2026-11-07"] == "present"
    assert eleves[e1.id]["nb_presents"] == 1
    assert eleves[e1.id]["nb_absents"] == 0

    # e2 était absent le 07/11
    assert eleves[e2.id]["seances"]["2026-11-07"] == "absent"
    assert eleves[e2.id]["nb_presents"] == 0
    assert eleves[e2.id]["nb_absents"] == 1


def test_grille_mensuelle_format_invalide(client, create_centre_and_user):
    centre, user, headers = create_centre_and_user("Centre Inv", "directeur@inv.dz", role="directeur")
    res = client.get("/api/v1/presences/grille-mensuelle?groupe_id=1&mois=invalid-month", headers=headers)
    assert res.status_code == 400


def test_grille_mensuelle_tenant_isolation(client, db_session, create_centre_and_user):
    centre_a, user_a, headers_a = create_centre_and_user("Centre A", "dir_a@ecole.dz", role="directeur")
    centre_b, user_b, headers_b = create_centre_and_user("Centre B", "dir_b@ecole.dz", role="directeur")

    g_a = Groupe(centre_id=centre_a.id, nom="Groupe A", tarif=Decimal("2000.00"), capacite_max=20)
    db_session.add(g_a)
    db_session.commit()

    # L'utilisateur du Centre B ne peut pas accéder au groupe du Centre A
    res = client.get(f"/api/v1/presences/grille-mensuelle?groupe_id={g_a.id}&mois=2026-11", headers=headers_b)
    assert res.status_code == 404
