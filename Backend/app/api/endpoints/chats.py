"""
Chat endpoints.
"""
from typing import Annotated, Any, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, UploadFile, File
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import get_db, security
from app.models import Conversation, ConversationParticipant, User, Message, MessageType, UserBlock
from app.schemas.conversation import ConversationCreate, Chat, ChatParticipant
from app.api import deps
from jose import jwt, JWTError
from pydantic import ValidationError
from app.schemas import TokenPayload

router = APIRouter()

from app.services.websocket import manager

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
        await manager.disconnect_async(websocket, user_id)



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
    current_user: Annotated[User, Depends(deps.get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    text: Annotated[str | None, Query()] = None,
    files: List[UploadFile] = File(default=[]),
) -> Any:
    """Send a message with optional file attachments."""
    from fastapi import UploadFile, File, Form
    from pathlib import Path
    import uuid
    import aiofiles
    from app.models import Attachment
    
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

    # Check for blocks
    # If I am blocked by any other participant, I cannot send message.
    other_participants_ids = [p.user_id for p in chat.participants if p.user_id != current_user.id]
    if other_participants_ids:
        # Check if current_user is blocked BY them (blocker=them, blocked=me)
        block_stmt = select(UserBlock).where(
            UserBlock.blocker_id.in_(other_participants_ids),
            UserBlock.blocked_id == current_user.id
        )
        block_result = await db.execute(block_stmt)
        if block_result.first():
            raise HTTPException(status_code=403, detail="You are blocked by this user")

    # Validate that we have either text or files
    if not text and not files:
        raise HTTPException(status_code=400, detail="Message must have text or attachments")
    
    # Determine message type
    message_type = MessageType.text
    if files:
        # Check if all files are images
        image_types = {"image/jpeg", "image/png", "image/gif", "image/webp"}
        all_images = all(
            getattr(f, "content_type", "").lower() in image_types 
            for f in files if hasattr(f, "content_type")
        )
        message_type = MessageType.image if all_images else MessageType.file
        
    # 2. Create message
    new_message = Message(
        conversation_id=chat_id,
        sender_id=current_user.id,
        content=text,
        type=message_type
    )
    db.add(new_message)
    await db.flush()  # Get message ID
    
    # 3. Handle file uploads
    upload_base_dir = Path(__file__).parent.parent.parent.parent / "uploads"
    chat_upload_dir = upload_base_dir / str(chat_id)
    chat_upload_dir.mkdir(parents=True, exist_ok=True)
    
    attachments_data = []
    for file in files:
        if not hasattr(file, "filename"):
            continue
            
        # Check file size (10MB limit)
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset
        
        if file_size > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(status_code=400, detail=f"File {file.filename} exceeds 10MB limit")
        
        # Generate unique filename
        file_ext = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = chat_upload_dir / unique_filename
        
        # Save file
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Create attachment record with chat-specific path
        attachment = Attachment(
            message_id=new_message.id,
            file_url=f"/uploads/{chat_id}/{unique_filename}",
            file_type=getattr(file, "content_type", None),
            file_name=file.filename,
            file_size=file_size
        )
        db.add(attachment)
        attachments_data.append({
            "fileUrl": f"/uploads/{chat_id}/{unique_filename}",
            "fileType": attachment.file_type,
            "fileName": attachment.file_name,
            "fileSize": attachment.file_size
        })
    
    await db.commit()
    await db.refresh(new_message)
    
    # 4. Broadcast via WebSocket
    msg_dict = {
        "id": str(new_message.id),
        "chatId": str(chat_id),
        "senderId": str(current_user.id),
        "text": text or "",
        "time": new_message.created_at.strftime("%H:%M"),
        "senderName": current_user.username,
        "attachments": attachments_data
    }
    
    for p in chat.participants:
        await manager.send_personal_message(msg_dict, p.user_id)
        
    return msg_dict


@router.get("/{chat_id}/messages", response_model=List[dict])
async def get_messages(
    chat_id: UUID,
    current_user: Annotated[User, Depends(deps.get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    query: Annotated[str | None, Query()] = None,
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
    filters = [Message.conversation_id == chat_id]
    if query:
        filters.append(and_(
            Message.content.ilike(f"%{query}%"),
            Message.is_deleted == False  # Only search non-deleted messages
        ))
    
    stmt = select(Message).where(
        and_(*filters)
    ).order_by(
        Message.created_at.asc()  # Oldest to newest
    ).options(
        selectinload(Message.sender),
        selectinload(Message.attachments)
    )
    
    result = await db.execute(stmt)
    messages = result.scalars().all()
    
    # 3. Map to frontend format
    messages_dto = []
    for msg in messages:
        attachments_data = [
            {
                "id": str(att.id),
                "fileUrl": att.file_url,
                "fileType": att.file_type,
                "fileName": att.file_name,
                "fileSize": att.file_size
            }
            for att in msg.attachments
        ]
        
        messages_dto.append({
            "id": str(msg.id),
            "chatId": str(chat_id),
            "senderId": str(msg.sender_id) if msg.sender_id else None,
            "text": msg.content,
            "time": msg.created_at.strftime("%H:%M"),
            "senderName": msg.sender.username if msg.sender else "System",
            "isIncoming": msg.sender_id != current_user.id if msg.sender_id else False,
            "attachments": attachments_data
        })
    
    return messages_dto


@router.delete("/{chat_id}/messages/{message_id}", response_model=dict)
async def delete_message(
    chat_id: UUID,
    message_id: UUID,
    current_user: Annotated[User, Depends(deps.get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Any:
    """
    Soft delete a message.
    """
    # 1. Verify message exists and belongs to user
    stmt = select(Message).where(
        and_(
            Message.id == message_id,
            Message.conversation_id == chat_id,
            Message.sender_id == current_user.id
        )
    ).options(
        selectinload(Message.conversation).selectinload(Conversation.participants)
    )
    result = await db.execute(stmt)
    message = result.scalars().first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found or not owned by user")
    
    if message.is_deleted:
        return {"status": "success", "message": "Message already deleted"}

    # 2. Soft delete
    message.is_deleted = True
    message.content = None 
    message.attachments = []
    
    await db.commit()
    
    # 3. Broadcast update
    msg_dict = {
        "type": "message_update",
        "id": str(message.id),
        "chatId": str(chat_id),
        "isRecalled": True,
        "text": None,
        "attachments": []
    }
    
    for p in message.conversation.participants:
        await manager.send_personal_message(msg_dict, p.user_id)
        
    return {"status": "success", "message": "Message deleted"}


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
            selectinload(Message.sender),
            selectinload(Message.attachments)
        ) # Warning: optimized loading needed for production to avoid loading ALL messages
    )
    
    result = await db.execute(stmt)
    conversations = result.scalars().all()
    
    # Pre-fetch "users who have blocked me"
    # This is to set isBlockedBy flag
    blocked_by_stmt = select(UserBlock.blocker_id).where(UserBlock.blocked_id == current_user.id)
    blocked_by_result = await db.execute(blocked_by_stmt)
    blocked_by_ids = set(str(uid) for uid in blocked_by_result.scalars().all())

    return [_map_conversation_to_chat(c, current_user.id, blocked_by_ids) for c in conversations]


def _map_conversation_to_chat(
    conv: Conversation, 
    current_user_id: UUID, 
    blocked_by_ids: set[str] = set()
) -> Chat:
    # Determine chat name and avatar (the other person)
    other_participants = [p for p in conv.participants if p.user_id != current_user_id]
    
    is_online = False
    is_blocked_by = False
    
    if conv.is_group:
        name = conv.name or "Group Chat"
        avatar = None # TODO: group avatar
    else:
        if other_participants:
            other = other_participants[0].user
            name = other.username
            avatar = other.avatar_url
            # Check online status using the global manager
            is_online = other.id in manager.active_connections
            
            # Check if I am blocked by this user
            if str(other.id) in blocked_by_ids:
                is_blocked_by = True
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
            
            # Build last message preview
            if last_m.content:
                last_msg = last_m.content
            elif last_m.attachments:
                # Check actual attachments content
                all_images = all(
                    a.file_type and a.file_type.startswith("image/") 
                    for a in last_m.attachments
                )
                last_msg = "📷 Image" if all_images else "📎 File"
            elif last_m.type == MessageType.image:
                last_msg = "📷 Image"
            elif last_m.type == MessageType.file:
                last_msg = "📎 File"
            else:
                last_msg = "Attachment"
            
            time = last_m.created_at.strftime("%H:%M")
    
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
        unreadCount=unread_count,
        isOnline=is_online,
        isBlockedBy=is_blocked_by
    )

