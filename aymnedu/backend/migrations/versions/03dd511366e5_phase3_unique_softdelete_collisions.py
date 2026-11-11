"""phase3_unique_softdelete_collisions

Revision ID: 03dd511366e5
Revises: 0001_initial_schema
Create Date: 2026-09-17 01:37:04.814708

NOTE: deleted_at columns and unique constraints are already created in
0001_initial_schema for fresh installs.  This migration is kept for
databases upgraded from the original schema (before 0001_initial_schema
was introduced) where the columns and constraints did not yet exist.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = '03dd511366e5'
down_revision: Union[str, Sequence[str], None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    """Return True if the column already exists (idempotent guard)."""
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = [c["name"] for c in inspector.get_columns(table)]
    return column in cols


def _index_exists(table: str, index_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    indexes = [i["name"] for i in inspector.get_indexes(table)]
    return index_name in indexes


def _unique_constraint_exists(table: str, constraint_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    ucs = [uc["name"] for uc in inspector.get_unique_constraints(table)]
    return constraint_name in ucs


def upgrade() -> None:
    """Upgrade schema — idempotent: skips objects already created by 0001."""
    # eleves.deleted_at
    if not _column_exists("eleves", "deleted_at"):
        with op.batch_alter_table('eleves', schema=None) as batch_op:
            batch_op.add_column(sa.Column('deleted_at', sa.DateTime(), nullable=True))
    if not _index_exists("eleves", "ix_eleves_deleted_at"):
        with op.batch_alter_table('eleves', schema=None) as batch_op:
            batch_op.create_index('ix_eleves_deleted_at', ['deleted_at'], unique=False)

    # groupes.deleted_at
    if not _column_exists("groupes", "deleted_at"):
        with op.batch_alter_table('groupes', schema=None) as batch_op:
            batch_op.add_column(sa.Column('deleted_at', sa.DateTime(), nullable=True))
    if not _index_exists("groupes", "ix_groupes_deleted_at"):
        with op.batch_alter_table('groupes', schema=None) as batch_op:
            batch_op.create_index('ix_groupes_deleted_at', ['deleted_at'], unique=False)

    # unique constraints
    if not _unique_constraint_exists("inscriptions_groupes", "uq_inscription_eleve_groupe"):
        with op.batch_alter_table('inscriptions_groupes', schema=None) as batch_op:
            batch_op.create_unique_constraint('uq_inscription_eleve_groupe', ['eleve_id', 'groupe_id'])

    if not _unique_constraint_exists("paiements", "uq_paiement_eleve_groupe_mois"):
        with op.batch_alter_table('paiements', schema=None) as batch_op:
            batch_op.create_unique_constraint('uq_paiement_eleve_groupe_mois', ['eleve_id', 'groupe_id', 'mois'])

    if not _unique_constraint_exists("presences", "uq_presence_eleve_groupe_date"):
        with op.batch_alter_table('presences', schema=None) as batch_op:
            batch_op.create_unique_constraint('uq_presence_eleve_groupe_date', ['eleve_id', 'groupe_id', 'date_seance'])


def downgrade() -> None:
    """Downgrade schema."""
    if _unique_constraint_exists("presences", "uq_presence_eleve_groupe_date"):
        with op.batch_alter_table('presences', schema=None) as batch_op:
            batch_op.drop_constraint('uq_presence_eleve_groupe_date', type_='unique')

    if _unique_constraint_exists("paiements", "uq_paiement_eleve_groupe_mois"):
        with op.batch_alter_table('paiements', schema=None) as batch_op:
            batch_op.drop_constraint('uq_paiement_eleve_groupe_mois', type_='unique')

    if _unique_constraint_exists("inscriptions_groupes", "uq_inscription_eleve_groupe"):
        with op.batch_alter_table('inscriptions_groupes', schema=None) as batch_op:
            batch_op.drop_constraint('uq_inscription_eleve_groupe', type_='unique')

    if _index_exists("groupes", "ix_groupes_deleted_at"):
        with op.batch_alter_table('groupes', schema=None) as batch_op:
            batch_op.drop_index('ix_groupes_deleted_at')
    if _column_exists("groupes", "deleted_at"):
        with op.batch_alter_table('groupes', schema=None) as batch_op:
            batch_op.drop_column('deleted_at')

    if _index_exists("eleves", "ix_eleves_deleted_at"):
        with op.batch_alter_table('eleves', schema=None) as batch_op:
            batch_op.drop_index('ix_eleves_deleted_at')
    if _column_exists("eleves", "deleted_at"):
        with op.batch_alter_table('eleves', schema=None) as batch_op:
            batch_op.drop_column('deleted_at')
