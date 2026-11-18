"""add license_vouchers and platform_admins tables

Revision ID: 0003_add_license_vouchers_and_superadmin
Revises: 0002_add_refresh_tokens
Create Date: 2026-11-18 01:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = '0003_add_license_vouchers_and_superadmin'
down_revision: Union[str, Sequence[str], None] = '0002_add_refresh_tokens'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    # ── license_vouchers ─────────────────────────────────────────────────────
    if not _table_exists("license_vouchers"):
        op.create_table(
            "license_vouchers",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("code", sa.String(50), unique=True, index=True, nullable=False),
            sa.Column("plan", sa.String(50), nullable=False, server_default="pro"),
            sa.Column("duration_days", sa.Integer(), nullable=False, server_default="30"),
            sa.Column("max_eleves", sa.Integer(), nullable=False, server_default="500"),
            sa.Column("is_redeemed", sa.Boolean(), nullable=False, server_default="false", index=True),
            sa.Column(
                "redeemed_by_centre_id",
                sa.Integer(),
                sa.ForeignKey("centres.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("redeemed_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
            sa.Column("note", sa.String(255), nullable=True),
        )

    # ── platform_admins ──────────────────────────────────────────────────────
    if not _table_exists("platform_admins"):
        op.create_table(
            "platform_admins",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("email", sa.String(200), unique=True, index=True, nullable=False),
            sa.Column("hashed_password", sa.String(255), nullable=False),
            sa.Column("full_name", sa.String(200), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default="true"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        )


def downgrade() -> None:
    if _table_exists("platform_admins"):
        op.drop_table("platform_admins")
    if _table_exists("license_vouchers"):
        op.drop_table("license_vouchers")

