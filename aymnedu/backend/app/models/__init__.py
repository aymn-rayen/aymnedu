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


class VersementModeEnum(str, Enum):
    especes = "especes"
    baridimob = "baridimob"
    cheque = "cheque"
    virement = "virement"


class ClotureStatutEnum(str, Enum):
    ouverte = "ouverte"
    en_attente_validation = "en_attente_validation"
    validee = "validee"


# ── Centre ──────────────────────────────────────────────────────────────────
class Centre(Base):
    __tablename__ = "centres"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String(200), nullable=False)
    adresse = Column(Text)
    wilaya = Column(String(100))
    telephone = Column(String(20))
    subscription_plan = Column(String(50), default="starter")
    subscription_status = Column(String(50), default="trial")  # "trial" | "active" | "expired" | "suspended"
    trial_ends_at = Column(DateTime, nullable=True)
    subscription_expires_at = Column(DateTime, nullable=True)
    max_eleves = Column(Integer, default=50)
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
    tarif = Column(Numeric(10, 2), nullable=False, default=2500.00)
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
    centre_id = Column(Integer, ForeignKey("centres.id", ondelete="RESTRICT"), nullable=False, index=True)
    eleve_id = Column(Integer, ForeignKey("eleves.id", ondelete="RESTRICT"), nullable=False)
    groupe_id = Column(Integer, ForeignKey("groupes.id", ondelete="RESTRICT"), nullable=False)
    montant = Column(Numeric(10, 2), nullable=False)         # montant total dû
    montant_verse = Column(Numeric(10, 2), nullable=False, default=0)  # montant déjà encaissé
    mois = Column(String(7), nullable=False)   # ex: "2026-07"
    statut = Column(SAEnum(PaiementStatutEnum), default="impaye")
    date_paiement = Column(DateTime, nullable=True)          # date du dernier versement
    recu_numero = Column(String(50), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    eleve = relationship("Eleve", back_populates="paiements")
    groupe = relationship("Groupe")
    versements = relationship("Versement", back_populates="paiement", cascade="all, delete-orphan", order_by="Versement.id.desc()")


# ── Versement (Ligne d'encaissement unitaire & traçabilité de caisse) ─────────
class Versement(Base):
    __tablename__ = "versements"

    id = Column(Integer, primary_key=True, index=True)
    paiement_id = Column(Integer, ForeignKey("paiements.id", ondelete="RESTRICT"), nullable=False, index=True)
    centre_id = Column(Integer, ForeignKey("centres.id", ondelete="RESTRICT"), nullable=False, index=True)
    recu_par_user_id = Column(Integer, ForeignKey("utilisateurs.id", ondelete="SET NULL"), nullable=True)
    montant = Column(Numeric(10, 2), nullable=False)
    mode_reglement = Column(SAEnum(VersementModeEnum), default="especes", nullable=False)
    recu_numero = Column(String(64), unique=True, index=True, nullable=False)
    date_versement = Column(DateTime, server_default=func.now(), nullable=False)

    paiement = relationship("Paiement", back_populates="versements")
    centre = relationship("Centre")
    recu_par = relationship("Utilisateur")


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


# ── Refresh Token (Session & Rotation) ───────────────────────────────────────
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("utilisateurs.id", ondelete="CASCADE"), nullable=False, index=True)
    jti = Column(String(64), unique=True, index=True, nullable=False)
    family_id = Column(String(64), index=True, nullable=False)
    token_hash = Column(String(64), nullable=False)  # SHA-256 du refresh token
    expires_at = Column(DateTime, nullable=False, index=True)
    revoked_at = Column(DateTime, nullable=True, default=None, index=True)
    created_at = Column(DateTime, server_default=func.now())
    user_agent = Column(String(255), nullable=True)
    ip_address = Column(String(50), nullable=True)

    user = relationship("Utilisateur", backref="refresh_tokens")


# ── License Voucher (Coupons prépayés à usage unique) ────────────────────────
class LicenseVoucher(Base):
    __tablename__ = "license_vouchers"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    plan = Column(String(50), nullable=False, default="pro")            # "starter" | "pro"
    duration_days = Column(Integer, nullable=False, default=30)         # 30, 90, 365
    max_eleves = Column(Integer, nullable=False, default=500)
    is_redeemed = Column(Boolean, default=False, nullable=False, index=True)
    redeemed_by_centre_id = Column(Integer, ForeignKey("centres.id", ondelete="SET NULL"), nullable=True)
    redeemed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    note = Column(String(255), nullable=True)

    redeemed_by = relationship("Centre")


# ── Platform Admin (Super-Admin AymnEDU) ────────────────────────────────────
class PlatformAdmin(Base):
    __tablename__ = "platform_admins"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(200), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


# ── Clôture de Caisse Journalière ───────────────────────────────────────────
class ClotureCaisse(Base):
    __tablename__ = "clotures_caisse"
    __table_args__ = (
        UniqueConstraint("centre_id", "date_cloture", name="uq_cloture_centre_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    centre_id = Column(Integer, ForeignKey("centres.id", ondelete="RESTRICT"), nullable=False, index=True)
    date_cloture = Column(Date, nullable=False, index=True)
    statut = Column(SAEnum(ClotureStatutEnum), default=ClotureStatutEnum.ouverte, nullable=False)

    total_especes_theorique = Column(Numeric(10, 2), default=0.00, nullable=False)
    total_baridimob_theorique = Column(Numeric(10, 2), default=0.00, nullable=False)
    total_especes_reel = Column(Numeric(10, 2), nullable=True)
    ecart = Column(Numeric(10, 2), nullable=True)  # reel - theorique
    nb_versements = Column(Integer, default=0, nullable=False)

    notes = Column(Text, nullable=True)
    ferme_par_user_id = Column(Integer, ForeignKey("utilisateurs.id", ondelete="SET NULL"), nullable=True)
    valide_par_user_id = Column(Integer, ForeignKey("utilisateurs.id", ondelete="SET NULL"), nullable=True)
    date_fermeture = Column(DateTime, nullable=True)
    date_validation = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    centre = relationship("Centre")
    ferme_par = relationship("Utilisateur", foreign_keys=[ferme_par_user_id])
    valide_par = relationship("Utilisateur", foreign_keys=[valide_par_user_id])

