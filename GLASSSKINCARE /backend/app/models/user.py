"""User model. Maps AI profiles to Shopify customer accounts."""
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shopify_customer_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    skin_embedding: Mapped[list | None] = mapped_column(Vector(384), nullable=True)
    # P2 Fix 8: bumped on password change so previously-issued JWTs (with
    # the matching `ver` claim) are rejected as 401. Closes the
    # credential-rotation window where a stolen token would survive a
    # password reset.
    token_version: Mapped[int] = mapped_column(
        Integer, default=1, server_default="1", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    skin_profile: Mapped["SkinProfile | None"] = relationship(back_populates="user", uselist=False)
    ai_conversations: Mapped[list["AIConversation"]] = relationship(back_populates="user")
