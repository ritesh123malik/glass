"""add user token_version

Revision ID: c1d2e3f4a5b6
Revises: b9c0d1e2f3a4
Create Date: 2026-09-01 14:30:00.000000

P2 Fix 8: token_version column on users, default 1. Incremented on password
change so previously-issued JWTs (which carry `ver` claim) become invalid.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c1d2e3f4a5b6"
down_revision = "b9c0d1e2f3a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "token_version",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")
