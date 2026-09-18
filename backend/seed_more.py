import sys
import os
import random
from datetime import date, time, datetime, timedelta

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.security import hash_password
from app.models import (
    Base, Centre, Utilisateur, RoleEnum, Eleve, Groupe, InscriptionGroupe,
    Paiement, Presence, Seance, StatutEnum, PaiementStatutEnum, PresenceStatutEnum
)

def generate_mock_data():
    print("Connecting to database...")
    engine = create_engine(settings.DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        centre = db.query(Centre).first()
        if not centre:
            centre = Centre(
                nom="Centre El-Feth (Soutien Scolaire)",
                adresse="12 Rue Didouche Mourad, Alger",
                wilaya="Alger",
                telephone="0550 12 34 56",
                subscription_plan="pro",
                is_active=True
            )
            db.add(centre)
            db.commit()
            db.refresh(centre)

        print(f"Target Centre: {centre.nom} (ID: {centre.id})")

        # 1. Create Enseignants (Professeurs)
        profs_info = [
            ("Prof. Slimane Benali", "slimane.maths@aymnedu.dz", "Mathématiques"),
            ("Prof. Amine Hamidi", "amine.physique@aymnedu.dz", "Physique-Chimie"),
            ("Dr. Karima Saidi", "karima.sciences@aymnedu.dz", "Sciences Naturelles"),
            ("Prof. Mokhtar Zergui", "mokhtar.arabe@aymnedu.dz", "Langue Arabe"),
            ("Mme. Sarah Ferhat", "sarah.francais@aymnedu.dz", "Français"),
            ("Mr. Karim Ouali", "karim.anglais@aymnedu.dz", "Anglais"),
        ]

        profs_objs = []
        for name, email, subj in profs_info:
            prof = db.query(Utilisateur).filter(Utilisateur.email == email).first()
            if not prof:
                prof = Utilisateur(
                    centre_id=centre.id,
                    email=email,
                    hashed_password=hash_password("prof1234"),
                    full_name=name,
                    role=RoleEnum.enseignant,
                    is_active=True
                )
                db.add(prof)
                db.commit()
                db.refresh(prof)
            profs_objs.append((prof, subj))

        print(f"Created/Verified {len(profs_objs)} Enseignants.")

        # 2. Create Groupes
        groupes_data = [
            ("Maths Terminale S (3AS)", "Mathématiques", "3AS", 25, profs_objs[0][0].id),
            ("Maths BEM (4AM)", "Mathématiques", "4AM", 20, profs_objs[0][0].id),
            ("Physique-Chimie 3AS BAC", "Physique", "3AS", 20, profs_objs[1][0].id),
            ("Physique-Chimie 4AM BEM", "Physique", "4AM", 20, profs_objs[1][0].id),
            ("Sciences Naturelles 3AS BAC", "Sciences", "3AS", 18, profs_objs[2][0].id),
            ("Langue Arabe & Littérature 3AS", "Arabe", "3AS", 25, profs_objs[3][0].id),
            ("Français Intensif BEM (4AM)", "Français", "4AM", 15, profs_objs[4][0].id),
            ("Anglais Communication & BAC (3AS)", "Anglais", "3AS", 20, profs_objs[5][0].id),
            ("Maths Première Année (1AS)", "Mathématiques", "1AS", 22, profs_objs[0][0].id),
            ("Sciences Primaire (5AP)", "Sciences", "5AP", 15, profs_objs[2][0].id),
        ]

        groupes_objs = []
        for nom_g, mat, niv, cap, prof_id in groupes_data:
            grp = db.query(Groupe).filter(Groupe.nom == nom_g, Groupe.centre_id == centre.id).first()
            if not grp:
                grp = Groupe(
                    centre_id=centre.id,
                    nom=nom_g,
                    matiere=mat,
                    niveau=niv,
                    capacite_max=cap,
                    enseignant_id=prof_id
                )
                db.add(grp)
                db.commit()
                db.refresh(grp)
            groupes_objs.append(grp)

        print(f"Created/Verified {len(groupes_objs)} Groupes.")

        # 3. Create Séances (Emploi du temps)
        seances_data = [
            (groupes_objs[0].id, profs_objs[0][0].id, "Salle 1 (Grand Amphi)", "Samedi", time(8, 30), time(10, 30)),
            (groupes_objs[1].id, profs_objs[0][0].id, "Salle 1 (Grand Amphi)", "Samedi", time(10, 45), time(12, 45)),
            (groupes_objs[2].id, profs_objs[1][0].id, "Salle Labo 2", "Samedi", time(13, 30), time(15, 30)),
            (groupes_objs[3].id, profs_objs[1][0].id, "Salle Labo 2", "Mardi", time(16, 0), time(18, 0)),
            (groupes_objs[4].id, profs_objs[2][0].id, "Salle 3", "Vendredi", time(9, 0), time(11, 0)),
            (groupes_objs[5].id, profs_objs[3][0].id, "Salle 2", "Vendredi", time(14, 0), time(16, 0)),
            (groupes_objs[6].id, profs_objs[4][0].id, "Salle 4", "Mardi", time(14, 0), time(16, 0)),
            (groupes_objs[7].id, profs_objs[5][0].id, "Salle 4", "Mercredi", time(15, 0), time(17, 0)),
            (groupes_objs[8].id, profs_objs[0][0].id, "Salle 1 (Grand Amphi)", "Jeudi", time(17, 0), time(19, 0)),
            (groupes_objs[9].id, profs_objs[2][0].id, "Salle 3", "Mardi", time(13, 0), time(15, 0)),
        ]

        for grp_id, prof_id, salle, jour, h_deb, h_fin in seances_data:
            s_exist = db.query(Seance).filter(Seance.groupe_id == grp_id, Seance.jour_semaine == jour).first()
            if not s_exist:
                seance = Seance(
                    centre_id=centre.id,
                    groupe_id=grp_id,
                    enseignant_id=prof_id,
                    salle=salle,
                    jour_semaine=jour,
                    heure_debut=h_deb,
                    heure_fin=h_fin
                )
                db.add(seance)
        db.commit()
        print("Séances schedule populated.")

        # 4. Create Students (30 Algerian Students)
        noms = ["Benali", "Bouabdallah", "Kacimi", "Belhadj", "Lounis", "Brahimi", "Oussalah", "Chaib", "Mebarki", "Taleb", "Hadji", "Zerrouki", "Khelifi", "Guerfi", "Zitouni"]
        prenoms_m = ["Chinez", "Rayan", "Yacine", "Karim", "Sofiane", "Walid", "Mehdi", "Abderrahmane", "Ilyes", "Zakaria", "Khaled", "Anis", "Tarek", "Nabil"]
        prenoms_f = ["Meriem", "Amel", "Lina", "Ines", "Nour", "Yasmine", "Chaima", "Amina", "Sarah", "Manel", "Syrine", "Rania", "Khadidja", "Wafa"]

        niveaux = ["3AS", "4AM", "1AS", "2AS", "5AP"]
        op_tels = ["0550", "0661", "0770", "0555", "0664", "0771"]

        eleves_objs = []
        random.seed(42)

        for i in range(30):
            if i % 2 == 0:
                prenom = random.choice(prenoms_m)
            else:
                prenom = random.choice(prenoms_f)
            nom = random.choice(noms)
            niveau = random.choice(niveaux)
            tel = f"{random.choice(op_tels)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}"

            # Check if student exists
            e_exist = db.query(Eleve).filter(Eleve.prenom == prenom, Eleve.nom == nom, Eleve.centre_id == centre.id).first()
            if not e_exist:
                e_exist = Eleve(
                    centre_id=centre.id,
                    prenom=prenom,
                    nom=nom,
                    niveau=niveau,
                    telephone_responsable=tel,
                    statut=StatutEnum.actif,
                    date_inscription=date(2026, random.randint(1, 6), random.randint(1, 28))
                )
                db.add(e_exist)
                db.commit()
                db.refresh(e_exist)
            eleves_objs.append(e_exist)

        print(f"Created/Verified {len(eleves_objs)} Élèves.")

        # 5. Enroll Students in Groups (Inscriptions)
        for eleve in eleves_objs:
            # Match groups by level or pick 1-2 random groups
            matching_grps = [g for g in groupes_objs if g.niveau == eleve.niveau]
            if not matching_grps:
                matching_grps = random.sample(groupes_objs, k=2)

            for grp in matching_grps[:2]:
                inscr_exist = db.query(InscriptionGroupe).filter(
                    InscriptionGroupe.eleve_id == eleve.id,
                    InscriptionGroupe.groupe_id == grp.id
                ).first()
                if not inscr_exist:
                    inscr = InscriptionGroupe(
                        eleve_id=eleve.id,
                        groupe_id=grp.id,
                        date_debut=eleve.date_inscription
                    )
                    db.add(inscr)
        db.commit()
        print("Inscriptions saved.")

        # 6. Generate Paiements for recent months (2026-06, 2026-07, 2026-08)
        mois_list = ["2026-06", "2026-07", "2026-08"]
        statuts_paiement = [PaiementStatutEnum.paye, PaiementStatutEnum.paye, PaiementStatutEnum.impaye, PaiementStatutEnum.partiel]

        tarifs = {
            "3AS": 3000,
            "4AM": 2500,
            "1AS": 2500,
            "2AS": 2500,
            "5AP": 2000
        }

        recu_counter = 1001
        for mois in mois_list:
            for eleve in eleves_objs:
                # Find student's enrolled groups
                inscriptions = db.query(InscriptionGroupe).filter(InscriptionGroupe.eleve_id == eleve.id).all()
                for inscr in inscriptions:
                    grp = db.query(Groupe).filter(Groupe.id == inscr.groupe_id).first()
                    if not grp:
                        continue

                    p_exist = db.query(Paiement).filter(
                        Paiement.eleve_id == eleve.id,
                        Paiement.groupe_id == grp.id,
                        Paiement.mois == mois
                    ).first()

                    if not p_exist:
                        st = random.choice(statuts_paiement)
                        tarif = tarifs.get(grp.niveau, 2500)
                        dt_pay = datetime(2026, int(mois.split("-")[1]), random.randint(1, 10)) if st == PaiementStatutEnum.paye else None
                        recu_no = f"REC-2026-{recu_counter}" if st == PaiementStatutEnum.paye else None
                        if st == PaiementStatutEnum.paye:
                            recu_counter += 1

                        p = Paiement(
                            centre_id=centre.id,
                            eleve_id=eleve.id,
                            groupe_id=grp.id,
                            montant=tarif if st != PaiementStatutEnum.partiel else (tarif / 2),
                            mois=mois,
                            statut=st,
                            date_paiement=dt_pay,
                            recu_numero=recu_no
                        )
                        db.add(p)
        db.commit()
        print("Paiements history generated.")

        # 7. Generate Présences history over past 4 weeks
        base_date = date(2026, 7, 1)
        statuts_presence = [PresenceStatutEnum.present, PresenceStatutEnum.present, PresenceStatutEnum.present, PresenceStatutEnum.absent, PresenceStatutEnum.retard]

        for week in range(4):
            seance_dt = base_date + timedelta(days=week * 7)
            for grp in groupes_objs:
                inscriptions = db.query(InscriptionGroupe).filter(InscriptionGroupe.groupe_id == grp.id).all()
                for inscr in inscriptions:
                    pres_exist = db.query(Presence).filter(
                        Presence.groupe_id == grp.id,
                        Presence.eleve_id == inscr.eleve_id,
                        Presence.date_seance == seance_dt
                    ).first()

                    if not pres_exist:
                        st = random.choice(statuts_presence)
                        retard = random.choice([5, 10, 15]) if st == PresenceStatutEnum.retard else 0
                        pres = Presence(
                            groupe_id=grp.id,
                            eleve_id=inscr.eleve_id,
                            date_seance=seance_dt,
                            statut=st,
                            minutes_retard=retard
                        )
                        db.add(pres)
        db.commit()
        print("Présences history generated successfully.")

        print("\nALL SIMULATED DATA GENERATED SUCCESSFULLY IN POSTGRESQL!")

    except Exception as e:
        db.rollback()
        print(f"Error generating data: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    generate_mock_data()
