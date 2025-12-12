"""
Chat endpoints.
"""
from typing import Annotated, Any, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core import get_db, security
from app.models import User
from app.schemas.conversation import ConversationCreate, Chat
from app.api import deps
from app.services.websocket import manager
from app.services.chat_service import ChatService
from app.schemas import TokenPayload
from jose import jwt, JWTError
from pydantic import ValidationError

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Annotated[str | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
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

    service = ChatService(db)
    
    # Check if user exists (Optional check as get_chat_user would fail or we can do it in service)
    # But usually service handles it. The service create_new_chat assumes user exists?
    # Original code checked participant existence.
    # Let's trust service to handle logic, or check quickly.
    participant = await db.get(User, chat_in.participantId)
    if not participant:
        raise HTTPException(status_code=404, detail="User not found")

    existing_chat = await service.get_chat_by_participant(current_user.id, chat_in.participantId)
    if existing_chat:
        return service._map_conversation_to_chat(existing_chat, current_user.id)

    new_chat = await service.create_new_chat(current_user.id, chat_in.participantId)
    return service._map_conversation_to_chat(new_chat, current_user.id)


@router.post("/{chat_id}/messages", response_model=Any)
async def send_message(
    chat_id: UUID,
    current_user: Annotated[User, Depends(deps.get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    text: Annotated[str | None, Query()] = None,
    files: List[UploadFile] = File(default=[]),
) -> Any:
    """Send a message with optional file attachments."""
    service = ChatService(db)
    return await service.send_message(current_user, chat_id, text, files)


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
    service = ChatService(db)
    return await service.get_messages(current_user.id, chat_id, query)


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
    service = ChatService(db)
    return await service.delete_message(current_user.id, chat_id, message_id)


@router.post("/{chat_id}/read", response_model=dict)
async def mark_chat_as_read(
    chat_id: UUID,
    current_user: Annotated[User, Depends(deps.get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Any:
    """
    Mark a chat as read by updating last_read_at timestamp.
    """
    service = ChatService(db)
    return await service.mark_as_read(current_user.id, chat_id)


@router.get("", response_model=List[Chat])
async def get_chats(
    current_user: Annotated[User, Depends(deps.get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Any:
    """
    Get all chats for current user.
    """
    service = ChatService(db)
    return await service.get_user_chats(current_user.id)
