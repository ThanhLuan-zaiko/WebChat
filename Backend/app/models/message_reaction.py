import enum
from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

class MessageReaction(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Message reaction model."""
    
    __tablename__ = "message_reactions"
    
    message_id: Mapped[UUID] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    emoji: Mapped[str] = mapped_column(String, nullable=False)
    
    # Relationships
    message: Mapped["Message"] = relationship(
        "Message",
        back_populates="reactions",
    )
    user: Mapped["User"] = relationship(
        "User",
    )
    
    def __repr__(self) -> str:
        return f"<MessageReaction(id={self.id}, emoji={self.emoji})>"
