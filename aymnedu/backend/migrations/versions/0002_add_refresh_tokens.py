"""add refresh_tokens table for session security and token rotation

Revision ID: 0002_add_refresh_tokens
Revises: 03dd511366e5
Create Date: 2026-11-17 20:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = '0002_add_refresh_tokens'
down_revision: Union[str, Sequence[str], None] = '03dd511366e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    if not _table_exists("refresh_tokens"):
        op.create_table(
            "refresh_tokens",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("utilisateurs.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("jti", sa.String(64), unique=True, index=True, nullable=False),
            sa.Column("family_id", sa.String(64), index=True, nullable=False),
            sa.Column("token_hash", sa.String(64), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False, index=True),
            sa.Column("revoked_at", sa.DateTime(), nullable=True, index=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
            sa.Column("user_agent", sa.String(255), nullable=True),
            sa.Column("ip_address", sa.String(50), nullable=True),
        )


def downgrade() -> None:
    if _table_exists("refresh_tokens"):
        op.drop_table("refresh_tokens")

