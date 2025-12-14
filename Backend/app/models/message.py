"""
Message model.
"""
import enum
from uuid import UUID

from sqlalchemy import Boolean, Enum, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class MessageType(str, enum.Enum):
    """Message type enum."""
    text = "text"
    image = "image"
    video = "video"
    file = "file"
    system = "system"


class Message(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Message table model."""
    
    __tablename__ = "messages"
    
    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    type: Mapped[MessageType] = mapped_column(
        Enum(MessageType, name="message_type_enum", create_type=False),
        default=MessageType.text,
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Relationships
    conversation: Mapped["Conversation"] = relationship(
        "Conversation",
        back_populates="messages",
    )
    sender: Mapped["User | None"] = relationship(
        "User",
        back_populates="messages",
    )
    attachments: Mapped[list["Attachment"]] = relationship(
        "Attachment",
        back_populates="message",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    reactions: Mapped[list["MessageReaction"]] = relationship(
        "MessageReaction",
        back_populates="message",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    
    def __repr__(self) -> str:
        return f"<Message(id={self.id}, type={self.type})>"


# Import để tránh circular import
from app.models.conversation import Conversation  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.attachment import Attachment  # noqa: E402
from app.models.message_reaction import MessageReaction  # noqa: E402
