"""
Chat endpoints.
"""
from typing import Annotated, Any, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import get_db, security
from app.models import Conversation, ConversationParticipant, User, Message, MessageType
from app.schemas.conversation import ConversationCreate, Chat, ChatParticipant
from app.api import deps
from jose import jwt, JWTError
from pydantic import ValidationError
from app.schemas import TokenPayload

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # Map user_id to list of active websockets (user might have multiple tabs)
        self.active_connections: dict[UUID, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: UUID):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: UUID):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: UUID):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_json(message)

manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Annotated[str | None, Query()] = None,
    db: AsyncSession = Depends(get_db), # Depends doesn't work well in WS directly usually, but standard FastAPI handles it
):
    if not token:
        await websocket.close(code=1008)
        return

    try:
        payload = jwt.decode(
            token, security.settings.SECRET_KEY, algorithms=[security.settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (JWTError, ValidationError):
        await websocket.close(code=1008)
        return

    username = token_data.sub
    
    # Verify user exists in DB and get ID
    stmt = select(User).where(User.username == username)
    result = await db.execute(stmt)
    user = result.scalars().first()
    
    if not user:
        await websocket.close(code=1008)
        return
        
    user_id = user.id
    await manager.connect(websocket, user_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)



@router.post("", response_model=Chat)
async def create_chat(
    chat_in: ConversationCreate,
    current_user: Annotated[User, Depends(deps.get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Any:
    """
    Create a new chat or return existing one.
    """
    if chat_in.participantId == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot chat with yourself")

    # Check if user exists
    participant = await db.get(User, chat_in.participantId)
    if not participant:
        raise HTTPException(status_code=404, detail="User not found")

    # Check for existing 1-on-1 conversation
    # We need to find a conversation where BOTH users are participants and is_group is False
    
    # Subquery to find conv_ids for current_user
    stmt_user = select(ConversationParticipant.conversation_id).where(
        ConversationParticipant.user_id == current_user.id
    )
    
    # Query matching conversations
    stmt = select(Conversation).join(
        ConversationParticipant, Conversation.id == ConversationParticipant.conversation_id
    ).where(
        and_(
            Conversation.is_group == False,
            ConversationParticipant.user_id == chat_in.participantId,
            Conversation.id.in_(stmt_user)
        )
    ).options(
        selectinload(Conversation.participants).selectinload(ConversationParticipant.user)
    )
    
    result = await db.execute(stmt)
    existing_chat = result.scalars().first()
    
    if existing_chat:
        return _map_conversation_to_chat(existing_chat, current_user.id)

    # Create new conversation
    new_chat = Conversation(is_group=False)
    db.add(new_chat)
    await db.flush() # Get ID

    # Add participants
    p1 = ConversationParticipant(conversation_id=new_chat.id, user_id=current_user.id)
    p2 = ConversationParticipant(conversation_id=new_chat.id, user_id=chat_in.participantId)
    db.add_all([p1, p2])
    
    await db.commit()
    
    # Reload with relationships
    stmt = select(Conversation).where(
        Conversation.id == new_chat.id
    ).options(
        selectinload(Conversation.participants).selectinload(ConversationParticipant.user)
    )
    result = await db.execute(stmt)
    created_chat = result.scalars().first()

    return _map_conversation_to_chat(created_chat, current_user.id)



@router.post("/{chat_id}/messages", response_model=Any)
async def send_message(
    chat_id: UUID,
    message_in: Annotated[dict, Any], # TODO: proper schema
    current_user: Annotated[User, Depends(deps.get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Any:
    # 1. Verify chat exists and user is participant
    stmt = select(Conversation).where(Conversation.id == chat_id).options(
        selectinload(Conversation.participants)
    )
    result = await db.execute(stmt)
    chat = result.scalars().first()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    is_participant = any(p.user_id == current_user.id for p in chat.participants)
    if not is_participant:
        raise HTTPException(status_code=403, detail="Not a participant")

    # 2. Create message
    content = message_in.get("text")
    if not content:
        raise HTTPException(status_code=400, detail="Content required")
        
    new_message = Message(
        conversation_id=chat_id,
        sender_id=current_user.id,
        content=content,
        type=MessageType.text
    )
    db.add(new_message)
    
    # 3. Update conversation timestamp
    # chat.last_message_at = func.now() # Handled by DB trigger usually
    
    await db.commit()
    await db.refresh(new_message)
    
    # 4. Broadcast via WebSocket
    msg_dict = {
        "id": str(new_message.id),
        "chatId": str(chat_id),
        "senderId": str(current_user.id),
        "text": content,
        "time": new_message.created_at.strftime("%H:%M"),
        "senderName": current_user.username,
        "senderName": current_user.username
    }
    
    for p in chat.participants:
        await manager.send_personal_message(msg_dict, p.user_id)
        
    return msg_dict


@router.get("/{chat_id}/messages", response_model=List[dict])
async def get_messages(
    chat_id: UUID,
    current_user: Annotated[User, Depends(deps.get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Any:
    """
    Get all messages for a specific chat.
    """
    # 1. Verify chat exists and user is participant
    stmt = select(Conversation).where(Conversation.id == chat_id).options(
        selectinload(Conversation.participants)
    )
    result = await db.execute(stmt)
    chat = result.scalars().first()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    is_participant = any(p.user_id == current_user.id for p in chat.participants)
    if not is_participant:
        raise HTTPException(status_code=403, detail="Not a participant")

    # 2. Fetch messages
    stmt = select(Message).where(
        Message.conversation_id == chat_id
    ).order_by(
        Message.created_at.asc()  # Oldest to newest
    ).options(
        selectinload(Message.sender)
    )
    
    result = await db.execute(stmt)
    messages = result.scalars().all()
    
    # 3. Map to frontend format
    messages_dto = []
    for msg in messages:
        messages_dto.append({
            "id": str(msg.id),
            "chatId": str(chat_id),
            "senderId": str(msg.sender_id) if msg.sender_id else None,
            "text": msg.content,
            "time": msg.created_at.strftime("%H:%M"),
            "senderName": msg.sender.username if msg.sender else "System",
            "isIncoming": msg.sender_id != current_user.id if msg.sender_id else False
        })
    
    return messages_dto


@router.post("/{chat_id}/read", response_model=dict)
async def mark_chat_as_read(
    chat_id: UUID,
    current_user: Annotated[User, Depends(deps.get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Any:
    """
    Mark a chat as read by updating last_read_at timestamp.
    """
    # Verify chat exists and user is participant
    stmt = select(ConversationParticipant).where(
        and_(
            ConversationParticipant.conversation_id == chat_id,
            ConversationParticipant.user_id == current_user.id
        )
    )
    result = await db.execute(stmt)
    participant = result.scalars().first()
    
    if not participant:
        raise HTTPException(status_code=404, detail="Chat not found or not a participant")
    
    # Update last_read_at to current time
    from datetime import datetime
    participant.last_read_at = datetime.utcnow()
    
    await db.commit()
    
    return {"status": "success", "message": "Chat marked as read"}


@router.get("", response_model=List[Chat])
async def get_chats(
    current_user: Annotated[User, Depends(deps.get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Any:
    """
    Get all chats for current user.
    """
    stmt = select(Conversation).join(
        ConversationParticipant
    ).where(
        ConversationParticipant.user_id == current_user.id
    ).order_by(
        Conversation.last_message_at.desc()
    ).options(
        selectinload(Conversation.participants).selectinload(ConversationParticipant.user),
        selectinload(Conversation.messages).options(
            selectinload(Message.sender)
        ) # Warning: optimized loading needed for production to avoid loading ALL messages
    )
    
    result = await db.execute(stmt)
    conversations = result.scalars().all()
    
    return [_map_conversation_to_chat(c, current_user.id) for c in conversations]


def _map_conversation_to_chat(conv: Conversation, current_user_id: UUID) -> Chat:
    # Determine chat name and avatar (the other person)
    other_participants = [p for p in conv.participants if p.user_id != current_user_id]
    
    if conv.is_group:
        name = conv.name or "Group Chat"
        avatar = None # TODO: group avatar
    else:
        if other_participants:
            other = other_participants[0].user
            name = other.username
            avatar = other.avatar_url
        else:
            name = "Unknown" # Should not happen in 1-on-1
            avatar = None

    # Participants DTO
    participants_dto = [
        ChatParticipant(
            id=p.user.id,
            username=p.user.username,
            avatar_url=p.user.avatar_url
        ) for p in conv.participants
    ]
    
    # Last message (naive implementation: taking from loaded relationship)
    # Ideally should be a separate efficient query or denormalized field
    last_msg = ""
    time = None
    if conv.messages:
        # Sort messages by created_at desc if not already
        sorted_msgs = sorted(conv.messages, key=lambda m: m.created_at, reverse=True)
        if sorted_msgs:
            last_m = sorted_msgs[0]
            last_msg = last_m.content
            time = last_m.created_at.strftime("%H:%M") # Format?
    
    # Calculate unread count
    current_participant = next((p for p in conv.participants if p.user_id == current_user_id), None)
    unread_count = 0
    if current_participant:
        # Count messages that are:
        # 1. Created after user's last_read_at
        # 2. Not sent by current user (incoming only)
        unread_count = sum(
            1 for msg in conv.messages
            if msg.created_at > current_participant.last_read_at
            and msg.sender_id != current_user_id
        )
    
    return Chat(
        id=conv.id,
        name=name,
        is_group=conv.is_group,
        participants=participants_dto,
        last_message=last_msg,
        time=time,
        unreadCount=unread_count
    )

