"""
User model.
"""
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """User table model."""
    
    __tablename__ = "users"
    
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Relationships
    messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="sender",
        lazy="selectin",
    )
    participations: Mapped[list["ConversationParticipant"]] = relationship(
        "ConversationParticipant",
        back_populates="user",
        lazy="selectin",
    )
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, username={self.username})>"


# Import để tránh circular import
from app.models.message import Message  # noqa: E402
from app.models.conversation import ConversationParticipant  # noqa: E402
