"""
Conversation and ConversationParticipant models.
"""
import enum
from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class UserRole(str, enum.Enum):
    """User role in conversation."""
    admin = "admin"
    member = "member"


class Conversation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Conversation table model."""
    
    __tablename__ = "conversations"
    
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_group: Mapped[bool] = mapped_column(Boolean, default=False)
    last_message_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        nullable=True,
    )
    
    # Relationships
    messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="conversation",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    participants: Mapped[list["ConversationParticipant"]] = relationship(
        "ConversationParticipant",
        back_populates="conversation",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    
    def __repr__(self) -> str:
        return f"<Conversation(id={self.id}, name={self.name})>"


class ConversationParticipant(Base):
    """Conversation participants junction table."""
    
    __tablename__ = "conversation_participants"
    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_conversation_user"),
    )
    
    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role_enum", create_type=False),
        default=UserRole.member,
    )
    joined_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    last_read_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    
    # Relationships
    conversation: Mapped["Conversation"] = relationship(
        "Conversation",
        back_populates="participants",
    )
    user: Mapped["User"] = relationship(
        "User",
        back_populates="participations",
    )
    
    def __repr__(self) -> str:
        return f"<ConversationParticipant(conv={self.conversation_id}, user={self.user_id})>"


# Import để tránh circular import
from app.models.message import Message  # noqa: E402
from app.models.user import User  # noqa: E402
