"""
Base model class with common fields.
"""
from datetime import datetime
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


class TimestampMixin:
    """Mixin for created_at and updated_at fields."""
    
    created_at: Mapped[datetime] = mapped_column(
        default=func.now(),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(),
        server_default=func.now(),
        onupdate=func.now(),
    )


class UUIDPrimaryKeyMixin:
    """Mixin for UUID primary key."""
    
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
