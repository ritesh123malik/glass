"""add theme_settings table

Revision ID: a1b2c3d4e5f6
Revises: 5648227de6bd
Create Date: 2026-09-01 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '5648227de6bd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'theme_settings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('tokens', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )


def downgrade() -> None:
    op.drop_table('theme_settings')
