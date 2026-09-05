"""Admin action audit log model."""
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class AdminAction(Base):
    __tablename__ = "admin_actions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    target_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    command: Mapped[str | None] = mapped_column(Text, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    admin: Mapped["User"] = relationship()
