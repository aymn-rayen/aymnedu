"""initial_schema — create all tables from scratch

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-11-11 21:00:00.000000

This is the FIRST migration.  Running `alembic upgrade head` on a brand-new
PostgreSQL database will:
  1. Create all tables (centres, utilisateurs, eleves, groupes,
     inscriptions_groupes, paiements, presences, seances).
  2. Apply unique constraints and indexes.
  3. Continue with 03dd511366e5 (phase3: soft-delete + extra constraints).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# ---------------------------------------------------------------------------
# Alembic revision identifiers
# ---------------------------------------------------------------------------
revision: str = "0001_initial_schema"
down_revision: Union[str, Sequence[str], None] = None          # first migration
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ---------------------------------------------------------------------------
# Enums (PostgreSQL native)
# ---------------------------------------------------------------------------
role_enum = sa.Enum("directeur", "secretaire", "enseignant", name="roleenum")
statut_enum = sa.Enum("actif", "inactif", name="statutenum")
paiement_statut_enum = sa.Enum("paye", "impaye", "partiel", name="paiementstatutenum")
presence_statut_enum = sa.Enum("present", "absent", "retard", name="presencestatutenum")


def upgrade() -> None:
    # ── centres ──────────────────────────────────────────────────────────────
    op.create_table(
        "centres",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("nom", sa.String(200), nullable=False),
        sa.Column("adresse", sa.Text(), nullable=True),
        sa.Column("wilaya", sa.String(100), nullable=True),
        sa.Column("telephone", sa.String(20), nullable=True),
        # Subscription fields
        sa.Column("subscription_plan", sa.String(50), nullable=True, server_default="starter"),
        sa.Column("subscription_status", sa.String(50), nullable=True, server_default="trial"),
        sa.Column("trial_ends_at", sa.DateTime(), nullable=True),
        sa.Column("subscription_expires_at", sa.DateTime(), nullable=True),
        sa.Column("max_eleves", sa.Integer(), nullable=True, server_default="50"),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default="true"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
    )

    # ── utilisateurs ─────────────────────────────────────────────────────────
    role_enum.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "utilisateurs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "centre_id",
            sa.Integer(),
            sa.ForeignKey("centres.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("email", sa.String(200), unique=True, index=True, nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("role", role_enum, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default="true"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
    )

    # ── eleves ───────────────────────────────────────────────────────────────
    statut_enum.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "eleves",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "centre_id",
            sa.Integer(),
            sa.ForeignKey("centres.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("matricule", sa.String(50), nullable=True, index=True),
        sa.Column("prenom", sa.String(100), nullable=False),
        sa.Column("nom", sa.String(100), nullable=False),
        sa.Column("telephone_responsable", sa.String(20), nullable=True),
        sa.Column("niveau", sa.String(50), nullable=True),
        sa.Column("date_inscription", sa.Date(), server_default=sa.text("current_date")),
        sa.Column("statut", statut_enum, nullable=True, server_default="actif"),
        # Soft-delete column (added here so the first install already has it)
        sa.Column("deleted_at", sa.DateTime(), nullable=True, index=True),
    )

    # ── groupes ──────────────────────────────────────────────────────────────
    op.create_table(
        "groupes",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "centre_id",
            sa.Integer(),
            sa.ForeignKey("centres.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("nom", sa.String(200), nullable=False),
        sa.Column("matiere", sa.String(100), nullable=True),
        sa.Column("niveau", sa.String(50), nullable=True),
        sa.Column("capacite_max", sa.Integer(), nullable=True, server_default="25"),
        sa.Column(
            "enseignant_id",
            sa.Integer(),
            sa.ForeignKey("utilisateurs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        # Soft-delete column
        sa.Column("deleted_at", sa.DateTime(), nullable=True, index=True),
    )

    # ── inscriptions_groupes ─────────────────────────────────────────────────
    op.create_table(
        "inscriptions_groupes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "eleve_id",
            sa.Integer(),
            sa.ForeignKey("eleves.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "groupe_id",
            sa.Integer(),
            sa.ForeignKey("groupes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date_debut", sa.Date(), server_default=sa.text("current_date")),
        sa.UniqueConstraint("eleve_id", "groupe_id", name="uq_inscription_eleve_groupe"),
    )

    # ── paiements ────────────────────────────────────────────────────────────
    paiement_statut_enum.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "paiements",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "centre_id",
            sa.Integer(),
            sa.ForeignKey("centres.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "eleve_id",
            sa.Integer(),
            sa.ForeignKey("eleves.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "groupe_id",
            sa.Integer(),
            sa.ForeignKey("groupes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("montant", sa.Numeric(10, 2), nullable=False),
        sa.Column("montant_verse", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("mois", sa.String(7), nullable=False),
        sa.Column("statut", paiement_statut_enum, nullable=True, server_default="impaye"),
        sa.Column("date_paiement", sa.DateTime(), nullable=True),
        sa.Column("recu_numero", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.UniqueConstraint("eleve_id", "groupe_id", "mois", name="uq_paiement_eleve_groupe_mois"),
    )

    # ── presences ────────────────────────────────────────────────────────────
    presence_statut_enum.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "presences",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "groupe_id",
            sa.Integer(),
            sa.ForeignKey("groupes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "eleve_id",
            sa.Integer(),
            sa.ForeignKey("eleves.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date_seance", sa.Date(), nullable=False),
        sa.Column("statut", presence_statut_enum, nullable=True, server_default="present"),
        sa.Column("minutes_retard", sa.Integer(), nullable=True, server_default="0"),
        sa.UniqueConstraint(
            "eleve_id", "groupe_id", "date_seance", name="uq_presence_eleve_groupe_date"
        ),
    )

    # ── seances ──────────────────────────────────────────────────────────────
    op.create_table(
        "seances",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "centre_id",
            sa.Integer(),
            sa.ForeignKey("centres.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "groupe_id",
            sa.Integer(),
            sa.ForeignKey("groupes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("salle", sa.String(100), nullable=True),
        sa.Column(
            "enseignant_id",
            sa.Integer(),
            sa.ForeignKey("utilisateurs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("jour_semaine", sa.String(10), nullable=False),
        sa.Column("heure_debut", sa.Time(), nullable=False),
        sa.Column("heure_fin", sa.Time(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("seances")
    op.drop_table("presences")
    presence_statut_enum.drop(op.get_bind(), checkfirst=True)
    op.drop_table("paiements")
    paiement_statut_enum.drop(op.get_bind(), checkfirst=True)
    op.drop_table("inscriptions_groupes")
    op.drop_table("groupes")
    op.drop_table("eleves")
    statut_enum.drop(op.get_bind(), checkfirst=True)
    op.drop_table("utilisateurs")
    role_enum.drop(op.get_bind(), checkfirst=True)
    op.drop_table("centres")
