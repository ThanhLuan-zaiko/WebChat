from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.user import UserPublic


class ConversationBase(BaseModel):
    name: str | None = None
    is_group: bool = False


class ConversationCreate(BaseModel):
    participantId: UUID


class Conversation(ConversationBase):
    id: UUID
    last_message_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    participants: list[UserPublic]  # Simplified logic to return user objects immediately? Or define Participant schema?
    # For now, let's assume we map the participants manually or use a flattened structure
    
    class Config:
        from_attributes = True


class ChatParticipant(BaseModel):
    id: UUID
    username: str
    avatar_url: str | None = None
    
    class Config:
        from_attributes = True


class Chat(ConversationBase):
    id: UUID
    participants: list[ChatParticipant]
    last_message: str | None = None  # Frontend expects this
    unreadCount: int = 0
    time: str | None = None
    
    class Config:
        from_attributes = True
