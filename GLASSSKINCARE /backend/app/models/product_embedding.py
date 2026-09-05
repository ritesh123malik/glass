"""Product embedding model."""
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector
from app.database import Base


class ProductEmbedding(Base):
    __tablename__ = "product_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shopify_product_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    shopify_handle: Mapped[str] = mapped_column(String(255), nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    skin_types: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)
    concerns: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)
    ingredients_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    benefit_embedding: Mapped[list | None] = mapped_column(Vector(384), nullable=True)
    last_synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
