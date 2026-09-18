import sys
import os
import sqlite3
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

# Add current path to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.core.database import Base
from app.core.security import hash_password
from app.models import Base, Centre, Utilisateur, RoleEnum, Eleve, Groupe, InscriptionGroupe, Paiement

def main():
    print("Initializing Database...")
    db_url = settings.DATABASE_URL
    print(f"Connecting to database at {db_url}")

    # Test connection, fallback to sqlite if postgres fails
    fallback_to_sqlite = False
    if "postgresql" in db_url:
        try:
            # We try to create engine and connect
            engine = create_engine(db_url, connect_args={"connect_timeout": 3})
            with engine.connect() as conn:
                print("Successfully connected to PostgreSQL database!")
        except Exception as e:
            print(f"PostgreSQL connection failed: {e}")
            print("Falling back to local SQLite database...")
            fallback_to_sqlite = True
    else:
        fallback_to_sqlite = "sqlite" in db_url

    if fallback_to_sqlite:
        db_url = "sqlite:///aymnedu.db"
        print(f"Using SQLite database: {db_url}")
        # Build SQLite engine
        engine = create_engine(db_url, connect_args={"check_same_thread": False})
        
        # Override the .env file to use sqlite for subsequent runs
        env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
        with open(env_path, "w", encoding="utf-8") as f:
            f.write(f"DATABASE_URL={db_url}\n")
            f.write("SECRET_KEY=aymnedu_secret_key_1234_local\n")
            f.write("ALGORITHM=HS256\n")
            f.write("CORS_ORIGINS=[\"http://localhost:5173\"]\n")
    else:
        engine = create_engine(db_url)

    # Re-apply SQLite settings to database engine if needed
    if "sqlite" in db_url:
        # Patch database.py settings class to use check_same_thread: False when connecting
        import app.core.database
        app.core.database.engine = engine
        app.core.database.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Create tables
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully.")

    # Create Session
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        # Check if centre exists
        centre = db.query(Centre).first()
        if not centre:
            print("Creating default Centre de soutien scolaire...")
            centre = Centre(
                nom="Centre El-Feth (Soutien Scolaire)",
                adresse="12 Rue Didouche Mourad, Alger",
                wilaya="Alger",
                telephone="0550 12 34 56",
                subscription_plan="starter",
                is_active=True
            )
            db.add(centre)
            db.commit()
            db.refresh(centre)
            print(f"Centre created: {centre.nom} (ID: {centre.id})")

        # Check if users exist
        user = db.query(Utilisateur).filter(Utilisateur.email == "directeur@aymnedu.dz").first()
        if not user:
            print("Creating default Directeur user...")
            user = Utilisateur(
                centre_id=centre.id,
                email="directeur@aymnedu.dz",
                hashed_password=hash_password("admin1234"),
                full_name="Aymn Benali",
                role=RoleEnum.directeur,
                is_active=True
            )
            db.add(user)
            
            # Create a Secretary user
            secretaire = Utilisateur(
                centre_id=centre.id,
                email="secretaire@aymnedu.dz",
                hashed_password=hash_password("secretaire1234"),
                full_name="Fatima Zohra",
                role=RoleEnum.secretaire,
                is_active=True
            )
            db.add(secretaire)
            
            # Create an Enseignant user
            enseignant = Utilisateur(
                centre_id=centre.id,
                email="enseignant@aymnedu.dz",
                hashed_password=hash_password("enseignant1234"),
                full_name="Prof. Slimane",
                role=RoleEnum.enseignant,
                is_active=True
            )
            db.add(enseignant)
            
            db.commit()
            print("Default users created:")
            print("  - Directeur  : directeur@aymnedu.dz / admin1234")
            print("  - Secrétaire : secretaire@aymnedu.dz / secretaire1234")
            print("  - Enseignant : enseignant@aymnedu.dz / enseignant1234")

        # Create demo students if none exist
        if db.query(Eleve).count() == 0:
            print("Seeding demo data (Élèves, Groupes, Inscriptions, Paiements)...")
            eleves_data = [
                ("Chinez", "Lounis", "3AS", "0661 11 22 33"),
                ("Rayan", "Bouabdallah", "4AM", "0550 44 55 66"),
                ("Meriem", "Kacimi", "5AP", "0770 77 88 99"),
                ("Yacine", "Belhadj", "1AS", "0664 33 22 11"),
            ]
            eleves = []
            for prenom, nom, niveau, tel in eleves_data:
                e = Eleve(centre_id=centre.id, prenom=prenom, nom=nom, niveau=niveau, telephone_responsable=tel)
                db.add(e)
                eleves.append(e)
            db.commit()

            # Create default Groups
            g1 = Groupe(centre_id=centre.id, nom="Mathématiques Terminale", matiere="Maths", niveau="3AS", capacite_max=20)
            g2 = Groupe(centre_id=centre.id, nom="Physique BEM", matiere="Physique", niveau="4AM", capacite_max=15)
            db.add_all([g1, g2])
            db.commit()

            # Inscriptions
            db.add_all([
                InscriptionGroupe(eleve_id=eleves[0].id, groupe_id=g1.id),
                InscriptionGroupe(eleve_id=eleves[3].id, groupe_id=g1.id),
                InscriptionGroupe(eleve_id=eleves[1].id, groupe_id=g2.id),
            ])
            db.commit()

            # Create some payments
            from datetime import datetime
            current_month = datetime.utcnow().strftime("%Y-%m")
            p1 = Paiement(centre_id=centre.id, eleve_id=eleves[0].id, groupe_id=g1.id, montant=2500, mois=current_month, statut="paye")
            p2 = Paiement(centre_id=centre.id, eleve_id=eleves[3].id, groupe_id=g1.id, montant=2500, mois=current_month, statut="impaye")
            db.add_all([p1, p2])
            db.commit()
            print("Demo data seeded successfully.")

    except Exception as ex:
        db.rollback()
        print(f"Error seeding data: {ex}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
