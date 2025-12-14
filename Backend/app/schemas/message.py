"""
Message schemas.
"""
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


class AttachmentCreate(BaseModel):
    """Schema for creating an attachment."""
    file_name: str
    file_type: str
    file_size: int
    file_url: str


class AttachmentResponse(BaseModel):
    """Schema for attachment response."""
    id: UUID
    file_name: str | None
    file_type: str | None
    file_size: int | None
    file_url: str
    created_at: datetime

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    """Schema for creating a message."""
    text: str | None = Field(None, description="Message text content")
    type: str = Field("text", description="Message type: text, image, file")
    is_encrypted: bool = False


class MessageResponse(BaseModel):
    """Schema for message response."""
    id: UUID
    chat_id: UUID
    sender_id: UUID | None
    text: str | None
    time: str
    sender_name: str | None
    is_incoming: bool
    is_encrypted: bool
    attachments: list[AttachmentResponse] = []

    class Config:
        from_attributes = True
