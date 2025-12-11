"""
Attachment model.
"""
from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin
from sqlalchemy import func
from datetime import datetime


class Attachment(Base, UUIDPrimaryKeyMixin):
    """Attachment table model."""
    
    __tablename__ = "attachments"
    
    message_id: Mapped[UUID] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False,
    )
    file_url: Mapped[str] = mapped_column(Text, nullable=False)
    file_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        default=func.now(),
        server_default=func.now(),
    )
    
    # Relationships
    message: Mapped["Message"] = relationship(
        "Message",
        back_populates="attachments",
    )
    
    def __repr__(self) -> str:
        return f"<Attachment(id={self.id}, file_name={self.file_name})>"


# Import để tránh circular import
from app.models.message import Message  # noqa: E402
