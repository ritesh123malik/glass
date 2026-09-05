"""Skin profile model."""
import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, ARRAY, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SkinProfile(Base):
    __tablename__ = "skin_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    skin_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    concerns: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)
    quiz_answers: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    photo_analysis: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="skin_profile")
