"""SQLAlchemy ORM models for AymnEDU"""
from datetime import date, time
from enum import Enum
from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric,
    String, Text, Time, UniqueConstraint, func, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from app.core.database import Base



class RoleEnum(str, Enum):
    directeur = "directeur"
    secretaire = "secretaire"
    enseignant = "enseignant"


class StatutEnum(str, Enum):
    actif = "actif"
    inactif = "inactif"


class PaiementStatutEnum(str, Enum):
    paye = "paye"
    impaye = "impaye"
    partiel = "partiel"


class PresenceStatutEnum(str, Enum):
    present = "present"
    absent = "absent"
    retard = "retard"


# ── Centre ──────────────────────────────────────────────────────────────────
class Centre(Base):
    __tablename__ = "centres"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String(200), nullable=False)
    adresse = Column(Text)
    wilaya = Column(String(100))
    telephone = Column(String(20))
    subscription_plan = Column(String(20), default="starter")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    utilisateurs = relationship("Utilisateur", back_populates="centre")
    eleves = relationship("Eleve", back_populates="centre")
    groupes = relationship("Groupe", back_populates="centre")


# ── Utilisateur ──────────────────────────────────────────────────────────────
class Utilisateur(Base):
    __tablename__ = "utilisateurs"

    id = Column(Integer, primary_key=True, index=True)
    centre_id = Column(Integer, ForeignKey("centres.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(200), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(200), nullable=False)
    role = Column(SAEnum(RoleEnum), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    centre = relationship("Centre", back_populates="utilisateurs")


# ── Elève ────────────────────────────────────────────────────────────────────
class Eleve(Base):
    __tablename__ = "eleves"

    id = Column(Integer, primary_key=True, index=True)
    centre_id = Column(Integer, ForeignKey("centres.id", ondelete="CASCADE"), nullable=False, index=True)
    matricule = Column(String(50), nullable=True, index=True)
    prenom = Column(String(100), nullable=False)
    nom = Column(String(100), nullable=False)
    telephone_responsable = Column(String(20))
    niveau = Column(String(50))
    date_inscription = Column(Date, server_default=func.current_date())
    statut = Column(SAEnum(StatutEnum), default="actif")
    # Soft Delete — NULL means active; timestamp means deleted
    deleted_at = Column(DateTime, nullable=True, default=None, index=True)

    centre = relationship("Centre", back_populates="eleves")
    paiements = relationship("Paiement", back_populates="eleve")
    presences = relationship("Presence", back_populates="eleve")
    inscriptions = relationship("InscriptionGroupe", back_populates="eleve")


# ── Groupe ───────────────────────────────────────────────────────────────────
class Groupe(Base):
    __tablename__ = "groupes"

    id = Column(Integer, primary_key=True, index=True)
    centre_id = Column(Integer, ForeignKey("centres.id", ondelete="CASCADE"), nullable=False, index=True)
    nom = Column(String(200), nullable=False)
    matiere = Column(String(100))
    niveau = Column(String(50))
    capacite_max = Column(Integer, default=25)
    enseignant_id = Column(Integer, ForeignKey("utilisateurs.id", ondelete="SET NULL"), nullable=True)
    # Soft Delete
    deleted_at = Column(DateTime, nullable=True, default=None, index=True)

    centre = relationship("Centre", back_populates="groupes")
    enseignant = relationship("Utilisateur")
    inscriptions = relationship("InscriptionGroupe", back_populates="groupe")
    seances = relationship("Seance", back_populates="groupe")
    presences = relationship("Presence", back_populates="groupe")


# ── InscriptionGroupe (M2M: Eleve — Groupe) ──────────────────────────────────
class InscriptionGroupe(Base):
    __tablename__ = "inscriptions_groupes"
    __table_args__ = (
        # Un élève ne peut être inscrit qu'une seule fois dans un groupe
        UniqueConstraint("eleve_id", "groupe_id", name="uq_inscription_eleve_groupe"),
    )

    id = Column(Integer, primary_key=True)
    eleve_id = Column(Integer, ForeignKey("eleves.id", ondelete="CASCADE"), nullable=False)
    groupe_id = Column(Integer, ForeignKey("groupes.id", ondelete="CASCADE"), nullable=False)
    date_debut = Column(Date, server_default=func.current_date())

    eleve = relationship("Eleve", back_populates="inscriptions")
    groupe = relationship("Groupe", back_populates="inscriptions")


# ── Paiement ─────────────────────────────────────────────────────────────────
class Paiement(Base):
    __tablename__ = "paiements"
    __table_args__ = (
        # Un seul paiement par élève, par groupe, par mois
        UniqueConstraint("eleve_id", "groupe_id", "mois", name="uq_paiement_eleve_groupe_mois"),
    )

    id = Column(Integer, primary_key=True, index=True)
    centre_id = Column(Integer, ForeignKey("centres.id", ondelete="CASCADE"), nullable=False, index=True)
    eleve_id = Column(Integer, ForeignKey("eleves.id", ondelete="CASCADE"), nullable=False)
    groupe_id = Column(Integer, ForeignKey("groupes.id", ondelete="CASCADE"), nullable=False)
    montant = Column(Numeric(10, 2), nullable=False)
    mois = Column(String(7), nullable=False)   # ex: "2026-07"
    statut = Column(SAEnum(PaiementStatutEnum), default="impaye")
    date_paiement = Column(DateTime, nullable=True)
    recu_numero = Column(String(50), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    eleve = relationship("Eleve", back_populates="paiements")
    groupe = relationship("Groupe")


# ── Présence ─────────────────────────────────────────────────────────────────
class Presence(Base):
    __tablename__ = "presences"
    __table_args__ = (
        # Un élève ne peut avoir qu'une seule entrée de présence par séance par groupe
        UniqueConstraint("eleve_id", "groupe_id", "date_seance", name="uq_presence_eleve_groupe_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    groupe_id = Column(Integer, ForeignKey("groupes.id", ondelete="CASCADE"), nullable=False)
    eleve_id = Column(Integer, ForeignKey("eleves.id", ondelete="CASCADE"), nullable=False)
    date_seance = Column(Date, nullable=False)
    statut = Column(SAEnum(PresenceStatutEnum), default="present")
    minutes_retard = Column(Integer, default=0)

    groupe = relationship("Groupe", back_populates="presences")
    eleve = relationship("Eleve", back_populates="presences")


# ── Séance (Emploi du temps) ──────────────────────────────────────────────────
class Seance(Base):
    __tablename__ = "seances"

    id = Column(Integer, primary_key=True, index=True)
    centre_id = Column(Integer, ForeignKey("centres.id", ondelete="CASCADE"), nullable=False)
    groupe_id = Column(Integer, ForeignKey("groupes.id", ondelete="CASCADE"), nullable=False)
    salle = Column(String(100))
    enseignant_id = Column(Integer, ForeignKey("utilisateurs.id", ondelete="SET NULL"), nullable=True)
    jour_semaine = Column(String(10), nullable=False)  # "lundi" .. "samedi"
    heure_debut = Column(Time, nullable=False)
    heure_fin = Column(Time, nullable=False)

    groupe = relationship("Groupe", back_populates="seances")
    enseignant = relationship("Utilisateur")
