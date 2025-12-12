"""
User Block model.
"""
from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class UserBlock(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """User Block table model."""
    
    __tablename__ = "user_blocks"
    
    blocker_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    blocked_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Relationships
    blocker: Mapped["User"] = relationship("User", foreign_keys=[blocker_id], lazy="selectin")
    blocked: Mapped["User"] = relationship("User", foreign_keys=[blocked_id], lazy="selectin")
    
    __table_args__ = (
        UniqueConstraint("blocker_id", "blocked_id", name="uq_user_block_blocker_blocked"),
    )

    def __repr__(self) -> str:
        return f"<UserBlock(blocker={self.blocker_id}, blocked={self.blocked_id})>"

# Avoid circular imports if needed, though lazy='selectin' usually handles it well with string references
from app.models.user import User  # noqa: E402
