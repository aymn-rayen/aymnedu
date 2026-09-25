import sys
import os
import random
from datetime import date, time, datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import (
    Centre, Utilisateur, RoleEnum, Eleve, Groupe,
    InscriptionGroupe, Paiement, Seance, StatutEnum,
    PaiementStatutEnum
)

def add_batch():
    db: Session = SessionLocal()
    try:
        centre = db.query(Centre).first()
        if not centre:
            print("Erreur: aucun centre trouvé!")
            return

        print(f"Centre cible: {centre.nom} (ID: {centre.id})")

        # ── 1. Ajouter 4 Enseignants (Professeurs) ──────────────────────────
        profs_data = [
            ("Prof. Yacine Brahimi", "yacine.info@aymnedu.dz", "Informatique"),
            ("Prof. Meriem Belkacem", "meriem.philo@aymnedu.dz", "Histoire/Géo"),
            ("Prof. Tarek Mansouri", "tarek.physique@aymnedu.dz", "Physique"),
            ("Dr. Nadia Cherif", "nadia.sciences@aymnedu.dz", "Science"),
        ]

        new_profs = []
        for full_name, email, subj in profs_data:
            existing = db.query(Utilisateur).filter(Utilisateur.email == email).first()
            if not existing:
                prof = Utilisateur(
                    centre_id=centre.id,
                    email=email,
                    hashed_password=hash_password("prof1234"),
                    full_name=full_name,
                    role=RoleEnum.enseignant,
                    is_active=True
                )
                db.add(prof)
                db.commit()
                db.refresh(prof)
                print(f"Professeur créé: {full_name} ({email})")
                new_profs.append((prof, subj))
            else:
                new_profs.append((existing, subj))

        # ── 2. Ajouter 3 Nouveaux Groupes ──────────────────────────────────
        groupes_data = [
            ("Informatique & Python (2AS)", "Informatique", "2AS", 16, new_profs[0][0].id),
            ("Philosophie & Pensée (3AS BAC)", "Histoire/Géo", "3AS", 20, new_profs[1][0].id),
            ("Physique Approfondie (3AS BAC)", "Physique", "3AS", 18, new_profs[2][0].id),
        ]

        new_groupes = []
        for nom, matiere, niveau, cap, prof_id in groupes_data:
            existing = db.query(Groupe).filter(Groupe.nom == nom, Groupe.centre_id == centre.id).first()
            if not existing:
                grp = Groupe(
                    centre_id=centre.id,
                    nom=nom,
                    matiere=matiere,
                    niveau=niveau,
                    capacite_max=cap,
                    enseignant_id=prof_id
                )
                db.add(grp)
                db.commit()
                db.refresh(grp)
                print(f"Groupe créé: {nom}")
                new_groupes.append(grp)
            else:
                new_groupes.append(existing)

        # ── 3. Ajouter 10 Nouveaux Élèves ──────────────────────────────────
        eleves_data = [
            ("Sofiane", "Mahrez", "3AS", "0551 23 45 67"),
            ("Rayane", "Ait-Ahmed", "2AS", "0662 34 56 78"),
            ("Lina", "Bouzid", "4AM", "0773 45 67 89"),
            ("Walid", "Guendouz", "3AS", "0554 56 78 90"),
            ("Chaima", "Kaci", "1AS", "0665 67 89 01"),
            ("Mehdi", "Saadaoui", "3AS", "0776 78 90 12"),
            ("Nour El Houda", "Tebboune", "4AM", "0557 89 01 23"),
            ("Akram", "Belhadj", "2AS", "0668 90 12 34"),
            ("Rania", "Medjahed", "5AP", "0779 01 23 45"),
            ("Anis", "Djebbar", "3AS", "0550 11 22 33"),
        ]

        new_eleves = []
        for prenom, nom, niveau, tel in eleves_data:
            existing = db.query(Eleve).filter(
                Eleve.prenom == prenom,
                Eleve.nom == nom,
                Eleve.centre_id == centre.id
            ).first()

            if not existing:
                count_total = db.query(Eleve).filter(Eleve.centre_id == centre.id).count()
                matr = f"E26-{centre.id:02d}-{(count_total + 1):04d}"
                eleve = Eleve(
                    centre_id=centre.id,
                    matricule=matr,
                    prenom=prenom,
                    nom=nom,
                    niveau=niveau,
                    telephone_responsable=tel,
                    statut=StatutEnum.actif,
                    date_inscription=date(2026, 9, random.randint(1, 20))
                )
                db.add(eleve)
                db.commit()
                db.refresh(eleve)
                print(f"Élève créé: {prenom} {nom} ({niveau}) - Matricule: {matr}")
                new_eleves.append(eleve)
            else:
                new_eleves.append(existing)

        # ── 4. Inscrire les élèves dans les nouveaux groupes ───────────────
        all_groupes = db.query(Groupe).filter(Groupe.centre_id == centre.id).all()
        for eleve in new_eleves:
            # Match with groups by niveau or random suitable group
            matching_grps = [g for g in all_groupes if g.niveau == eleve.niveau]
            targets = matching_grps if matching_grps else new_groupes[:1]

            for g in targets[:2]:
                already_inscr = db.query(InscriptionGroupe).filter(
                    InscriptionGroupe.eleve_id == eleve.id,
                    InscriptionGroupe.groupe_id == g.id
                ).first()
                if not already_inscr:
                    inscr = InscriptionGroupe(
                        eleve_id=eleve.id,
                        groupe_id=g.id,
                        date_debut=date(2026, 9, 1)
                    )
                    db.add(inscr)
                    db.commit()
                    print(f"Inscription: {eleve.prenom} {eleve.nom} -> {g.nom}")

        # ── 5. Générer les Paiements de test pour Septembre 2026 ───────────
        recu_base = 2001
        for eleve in new_eleves:
            inscriptions = db.query(InscriptionGroupe).filter(InscriptionGroupe.eleve_id == eleve.id).all()
            for insc in inscriptions:
                grp = db.query(Groupe).filter(Groupe.id == insc.groupe_id).first()
                if not grp:
                    continue

                for mois in ["2026-09"]:
                    p_exist = db.query(Paiement).filter(
                        Paiement.eleve_id == eleve.id,
                        Paiement.groupe_id == grp.id,
                        Paiement.mois == mois
                    ).first()

                    if not p_exist:
                        st = random.choice([PaiementStatutEnum.paye, PaiementStatutEnum.paye, PaiementStatutEnum.impaye, PaiementStatutEnum.partiel])
                        tarif = 3000 if "3AS" in grp.niveau else 2500
                        montant = tarif if st != PaiementStatutEnum.partiel else (tarif / 2)
                        recu_no = f"REC-202609-{recu_base:04d}" if st == PaiementStatutEnum.paye else None
                        dt_pay = datetime(2026, 9, random.randint(1, 15), 14, 30) if st == PaiementStatutEnum.paye else None

                        p = Paiement(
                            centre_id=centre.id,
                            eleve_id=eleve.id,
                            groupe_id=grp.id,
                            montant=montant,
                            mois=mois,
                            statut=st,
                            date_paiement=dt_pay,
                            recu_numero=recu_no
                        )
                        db.add(p)
                        if st == PaiementStatutEnum.paye:
                            recu_base += 1

        db.commit()

        # ── 6. Ajouter des séances d'emploi du temps pour les 3 nouveaux groupes ──
        seances_defs = [
            (new_groupes[0].id, "Salle 2", new_profs[0][0].id, "dimanche", time(17, 0), time(19, 0)),
            (new_groupes[1].id, "Salle 3", new_profs[1][0].id, "mardi", time(17, 30), time(19, 30)),
            (new_groupes[2].id, "Salle 1", new_profs[2][0].id, "vendredi", time(9, 0), time(11, 0)),
        ]

        for gid, salle, pid, jour, h_deb, h_fin in seances_defs:
            s_exist = db.query(Seance).filter(
                Seance.centre_id == centre.id,
                Seance.groupe_id == gid,
                Seance.jour_semaine == jour
            ).first()
            if not s_exist:
                seance = Seance(
                    centre_id=centre.id,
                    groupe_id=gid,
                    salle=salle,
                    enseignant_id=pid,
                    jour_semaine=jour,
                    heure_debut=h_deb,
                    heure_fin=h_fin
                )
                db.add(seance)
                print(f"Séance ajoutée: {jour.capitalize()} {h_deb}-{h_fin} ({salle})")

        db.commit()
        print("\nSUCCÈS: 10 élèves, 4 enseignants, 3 groupes, paiements et plannings ajoutés avec succès!")

    finally:
        db.close()

if __name__ == "__main__":
    add_batch()
