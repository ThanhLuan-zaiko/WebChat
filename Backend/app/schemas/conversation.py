from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.user import UserPublic


class ConversationBase(BaseModel):
    name: str | None = None
    is_group: bool = False


class ConversationCreate(BaseModel):
    participantId: UUID


class GroupConversationCreate(BaseModel):
    participantIds: list[UUID]
    name: str | None = None


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
    avatar: str | None = None
    role: str | None = None
    
    class Config:
        from_attributes = True


class Chat(BaseModel):
    id: UUID
    name: str | None = None
    isGroup: bool
    participants: list[ChatParticipant]
    lastMessage: str | None = None
    unreadCount: int = 0
    time: str | None = None
    isOnline: bool = False
    isBlockedBy: bool = False
    role: str | None = None
    
    class Config:
        from_attributes = True
