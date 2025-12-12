from typing import List, Optional, Any
from uuid import UUID
from pathlib import Path
import uuid
import aiofiles
from datetime import datetime

from fastapi import HTTPException, UploadFile
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Conversation, ConversationParticipant, User, Message, MessageType, UserBlock, Attachment
from app.schemas.conversation import ConversationCreate, Chat, ChatParticipant
from app.services.websocket import manager

class ChatService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_chat_by_participant(self, user_id: UUID, participant_id: UUID) -> Optional[Conversation]:
        """Find existing conversation between two users (1-on-1)."""
        # Subquery to find conv_ids for current_user
        stmt_user = select(ConversationParticipant.conversation_id).where(
            ConversationParticipant.user_id == user_id
        )
        
        # Query matching conversations
        stmt = select(Conversation).join(
            ConversationParticipant, Conversation.id == ConversationParticipant.conversation_id
        ).where(
            and_(
                Conversation.is_group == False,
                ConversationParticipant.user_id == participant_id,
                Conversation.id.in_(stmt_user)
            )
        ).options(
            selectinload(Conversation.participants).selectinload(ConversationParticipant.user)
        )
        
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def create_new_chat(self, user_id: UUID, participant_id: UUID) -> Conversation:
        """Create a new 1-on-1 conversation."""
        new_chat = Conversation(is_group=False)
        self.db.add(new_chat)
        await self.db.flush()

        # Add participants
        p1 = ConversationParticipant(conversation_id=new_chat.id, user_id=user_id)
        p2 = ConversationParticipant(conversation_id=new_chat.id, user_id=participant_id)
        self.db.add_all([p1, p2])
        
        await self.db.commit()
        
        # Reload with relationships
        stmt = select(Conversation).where(
            Conversation.id == new_chat.id
        ).options(
            selectinload(Conversation.participants).selectinload(ConversationParticipant.user)
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_chat_details(self, chat_id: UUID, user_id: UUID) -> Conversation:
        """Get chat details and verify participation."""
        stmt = select(Conversation).where(Conversation.id == chat_id).options(
            selectinload(Conversation.participants)
        )
        result = await self.db.execute(stmt)
        chat = result.scalars().first()
        
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
            
        is_participant = any(p.user_id == user_id for p in chat.participants)
        if not is_participant:
            raise HTTPException(status_code=403, detail="Not a participant")
            
        return chat

    async def check_block_status(self, chat: Conversation, current_user_id: UUID):
        """Check if current user is blocked by any other participant."""
        other_participants_ids = [p.user_id for p in chat.participants if p.user_id != current_user_id]
        if other_participants_ids:
            block_stmt = select(UserBlock).where(
                UserBlock.blocker_id.in_(other_participants_ids),
                UserBlock.blocked_id == current_user_id
            )
            block_result = await self.db.execute(block_stmt)
            if block_result.first():
                raise HTTPException(status_code=403, detail="You are blocked by this user")

    async def process_attachments(self, files: List[UploadFile], chat_id: UUID, message_id: UUID) -> List[dict]:
        """Save files and create attachment records."""
        upload_base_dir = Path(__file__).parent.parent.parent / "uploads"
        chat_upload_dir = upload_base_dir / str(chat_id)
        chat_upload_dir.mkdir(parents=True, exist_ok=True)
        
        attachments_data = []
        for file in files:
            if not hasattr(file, "filename"):
                continue
                
            # Check file size (10MB limit)
            file.file.seek(0, 2)
            file_size = file.file.tell()
            file.file.seek(0)
            
            if file_size > 10 * 1024 * 1024:
                raise HTTPException(status_code=400, detail=f"File {file.filename} exceeds 10MB limit")
            
            file_ext = Path(file.filename).suffix
            unique_filename = f"{uuid.uuid4()}{file_ext}"
            file_path = chat_upload_dir / unique_filename
            
            async with aiofiles.open(file_path, 'wb') as f:
                content = await file.read()
                await f.write(content)
            
            attachment = Attachment(
                message_id=message_id,
                file_url=f"/uploads/{chat_id}/{unique_filename}",
                file_type=getattr(file, "content_type", None),
                file_name=file.filename,
                file_size=file_size
            )
            self.db.add(attachment)
            attachments_data.append({
                "fileUrl": attachment.file_url,
                "fileType": attachment.file_type,
                "fileName": attachment.file_name,
                "fileSize": attachment.file_size
            })
        return attachments_data

    async def send_message(self, user: User, chat_id: UUID, text: str | None, files: List[UploadFile]) -> dict:
        """Process sending a message."""
        chat = await self.get_chat_details(chat_id, user.id)
        await self.check_block_status(chat, user.id)

        if not text and not files:
            raise HTTPException(status_code=400, detail="Message must have text or attachments")
        
        message_type = MessageType.text
        if files:
            image_types = {"image/jpeg", "image/png", "image/gif", "image/webp"}
            all_images = all(
                getattr(f, "content_type", "").lower() in image_types 
                for f in files if hasattr(f, "content_type")
            )
            message_type = MessageType.image if all_images else MessageType.file
            
        new_message = Message(
            conversation_id=chat_id,
            sender_id=user.id,
            content=text,
            type=message_type
        )
        self.db.add(new_message)
        await self.db.flush()
        
        attachments_data = await self.process_attachments(files, chat_id, new_message.id)
        
        await self.db.commit()
        await self.db.refresh(new_message)
        
        msg_dict = {
            "id": str(new_message.id),
            "chatId": str(chat_id),
            "senderId": str(user.id),
            "text": text or "",
            "time": new_message.created_at.strftime("%H:%M"),
            "senderName": user.username,
            "attachments": attachments_data
        }
        
        # Broadcast
        for p in chat.participants:
            await manager.send_personal_message(msg_dict, p.user_id)
            
        return msg_dict

    async def get_messages(self, user_id: UUID, chat_id: UUID, query: str | None) -> List[dict]:
        """Fetch messages."""
        chat = await self.get_chat_details(chat_id, user_id)
        
        filters = [Message.conversation_id == chat_id]
        if query:
            filters.append(and_(
                Message.content.ilike(f"%{query}%"),
                Message.is_deleted == False
            ))
        
        stmt = select(Message).where(
            and_(*filters)
        ).order_by(
            Message.created_at.asc()
        ).options(
            selectinload(Message.sender),
            selectinload(Message.attachments)
        )
        
        result = await self.db.execute(stmt)
        messages = result.scalars().all()
        
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
                "isIncoming": msg.sender_id != user_id if msg.sender_id else False,
                "attachments": attachments_data
            })
        return messages_dto

    async def delete_message(self, user_id: UUID, chat_id: UUID, message_id: UUID) -> dict:
        """Soft delete message."""
        stmt = select(Message).where(
            and_(
                Message.id == message_id,
                Message.conversation_id == chat_id,
                Message.sender_id == user_id
            )
        ).options(
            selectinload(Message.conversation).selectinload(Conversation.participants)
        )
        result = await self.db.execute(stmt)
        message = result.scalars().first()
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found or not owned by user")
        
        if message.is_deleted:
            return {"status": "success", "message": "Message already deleted"}

        message.is_deleted = True
        message.content = None 
        message.attachments = []
        
        await self.db.commit()
        
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

    async def mark_as_read(self, user_id: UUID, chat_id: UUID) -> dict:
        stmt = select(ConversationParticipant).where(
            and_(
                ConversationParticipant.conversation_id == chat_id,
                ConversationParticipant.user_id == user_id
            )
        )
        result = await self.db.execute(stmt)
        participant = result.scalars().first()
        
        if not participant:
            raise HTTPException(status_code=404, detail="Chat not found or not a participant")
        
        participant.last_read_at = datetime.utcnow()
        await self.db.commit()
        return {"status": "success", "message": "Chat marked as read"}

    async def get_user_chats(self, user_id: UUID) -> List[Chat]:
        stmt = select(Conversation).join(
            ConversationParticipant
        ).where(
            ConversationParticipant.user_id == user_id
        ).order_by(
            Conversation.last_message_at.desc()
        ).options(
            selectinload(Conversation.participants).selectinload(ConversationParticipant.user),
            selectinload(Conversation.messages).options(
                selectinload(Message.sender),
                selectinload(Message.attachments)
            )
        )
        
        result = await self.db.execute(stmt)
        conversations = result.scalars().all()
        
        blocked_by_stmt = select(UserBlock.blocker_id).where(UserBlock.blocked_id == user_id)
        blocked_by_result = await self.db.execute(blocked_by_stmt)
        blocked_by_ids = set(str(uid) for uid in blocked_by_result.scalars().all())

        return [self._map_conversation_to_chat(c, user_id, blocked_by_ids) for c in conversations]

    def _map_conversation_to_chat(self, conv: Conversation, current_user_id: UUID, blocked_by_ids: set[str] = set()) -> Chat:
        other_participants = [p for p in conv.participants if p.user_id != current_user_id]
        
        is_online = False
        is_blocked_by = False
        name = "Unknown"
        avatar = None
        
        if conv.is_group:
            name = conv.name or "Group Chat"
        else:
            if other_participants:
                other = other_participants[0].user
                name = other.username
                avatar = other.avatar_url
                is_online = other.id in manager.active_connections
                if str(other.id) in blocked_by_ids:
                    is_blocked_by = True

        participants_dto = [
            ChatParticipant(
                id=p.user.id,
                username=p.user.username,
                avatar_url=p.user.avatar_url
            ) for p in conv.participants
        ]
        
        last_msg = ""
        time = None
        if conv.messages:
            sorted_msgs = sorted(conv.messages, key=lambda m: m.created_at, reverse=True)
            if sorted_msgs:
                last_m = sorted_msgs[0]
                if last_m.content:
                    last_msg = last_m.content
                elif last_m.attachments:
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
        
        current_participant = next((p for p in conv.participants if p.user_id == current_user_id), None)
        unread_count = 0
        if current_participant:
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
