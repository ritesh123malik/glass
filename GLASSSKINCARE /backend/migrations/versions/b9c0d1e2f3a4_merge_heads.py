"""merge heads (vector_dim_384 + theme_settings)

Revision ID: b9c0d1e2f3a4
Revises: 43cf01fda405, a1b2c3d4e5f6
Create Date: 2026-09-01 13:50:00.000000

Both 43cf01fda405 (change vector dim to 384) and a1b2c3d4e5f6 (add theme_settings
table) branch from 5648227de6bd. This merge consolidates them into a single
linear head so `alembic upgrade head` does not fail.
"""
from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401


# revision identifiers, used by Alembic.
revision = "b9c0d1e2f3a4"
down_revision = ("43cf01fda405", "a1b2c3d4e5f6")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
