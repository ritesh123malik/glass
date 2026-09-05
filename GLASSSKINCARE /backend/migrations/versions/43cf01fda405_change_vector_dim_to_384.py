"""change vector dim to 384

Revision ID: 43cf01fda405
Revises: 5648227de6bd
Create Date: 2026-08-29 21:23:31.133439

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
import pgvector


revision: str = '43cf01fda405'
down_revision: Union[str, None] = '5648227de6bd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # all-MiniLM-L6-v2 actually outputs 384-dim, not 768-dim.
    # ALTER COLUMN ... TYPE vector(384) requires an explicit cast;
    # any rows with embeddings will be rejected (pgvector can't
    # change dim in place). Acceptable in dev — recreate table if needed.
    op.execute('ALTER TABLE users ALTER COLUMN skin_embedding TYPE vector(384)')
    op.execute('ALTER TABLE product_embeddings ALTER COLUMN benefit_embedding TYPE vector(384)')


def downgrade() -> None:
    op.execute('ALTER TABLE users ALTER COLUMN skin_embedding TYPE vector(768)')
    op.execute('ALTER TABLE product_embeddings ALTER COLUMN benefit_embedding TYPE vector(768)')
