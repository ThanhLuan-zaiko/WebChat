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

from app.models import Conversation, ConversationParticipant, User, Message, MessageType, UserBlock, Attachment, UserRole, MessageReaction
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

    async def create_group_chat(self, user_id: UUID, participant_ids: List[UUID], name: str | None) -> Conversation:
        """Create a new group conversation."""
        new_chat = Conversation(is_group=True, name=name)
        self.db.add(new_chat)
        await self.db.flush()

        # Add all participants (creator + selected users)
        # Creator is admin
        participants = [ConversationParticipant(conversation_id=new_chat.id, user_id=user_id, role=UserRole.admin)]
        for pid in participant_ids:
            if pid != user_id: # Prevent adding self twice if selected
                 participants.append(ConversationParticipant(conversation_id=new_chat.id, user_id=pid, role=UserRole.member))
        
        self.db.add_all(participants)
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
            selectinload(Conversation.participants).selectinload(ConversationParticipant.user)
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
            "senderAvatar": user.avatar_url,
            "type": new_message.type,
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
            selectinload(Message.attachments),
            selectinload(Message.reactions)
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
            
            # Process reactions
            reactions_map = {}
            for reaction in msg.reactions:
                if reaction.emoji not in reactions_map:
                    reactions_map[reaction.emoji] = {"count": 0, "userHasReacted": False}
                reactions_map[reaction.emoji]["count"] += 1
                if reaction.user_id == user_id:
                    reactions_map[reaction.emoji]["userHasReacted"] = True
            
            reactions_dto = [
                {"emoji": k, "count": v["count"], "userHasReacted": v["userHasReacted"]}
                for k, v in reactions_map.items()
            ]

            messages_dto.append({
                "id": str(msg.id),
                "chatId": str(chat_id),
                "senderId": str(msg.sender_id) if msg.sender_id else None,
                "text": msg.content,
                "time": msg.created_at.strftime("%H:%M"),
                "senderName": msg.sender.username if msg.sender else "System",
                "senderAvatar": msg.sender.avatar_url if msg.sender else None,
                "isIncoming": msg.sender_id != user_id if msg.sender_id else False,
                "type": msg.type,
                "attachments": attachments_data,
                "reactions": reactions_dto
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

    async def leave_group(self, user_id: UUID, chat_id: UUID) -> dict:
        """Leave a group chat."""
        # Check if chat exists and is group
        chat = await self.get_chat_details(chat_id, user_id)
        if not chat.is_group:
             raise HTTPException(status_code=400, detail="Cannot leave a 1-on-1 chat")

        # Get participant record
        stmt = select(ConversationParticipant).where(
            and_(
                ConversationParticipant.conversation_id == chat_id,
                ConversationParticipant.user_id == user_id
            )
        )
        result = await self.db.execute(stmt)
        participant = result.scalars().first()
        
        if not participant: # Should be caught by get_chat_details but safe check
            raise HTTPException(status_code=403, detail="Not a participant")

        await self.db.delete(participant)
        await self.db.commit()
        
        # Create persistent system message
        system_msg = Message(
            conversation_id=chat_id,
            sender_id=None, # System message has no sender
            content=f"{participant.user.username} has left the group",
            type=MessageType.system
        )
        self.db.add(system_msg)
        await self.db.commit()
        await self.db.refresh(system_msg)

        msg_dict = {
            "id": str(system_msg.id),
            "chatId": str(chat_id),
            "senderId": None,
            "text": system_msg.content,
            "time": system_msg.created_at.strftime("%H:%M"),
            "senderName": "System",
            "senderAvatar": None,
            "isIncoming": False,
            "type": "system"
        }
        
        stmt = select(ConversationParticipant).where(ConversationParticipant.conversation_id == chat_id)
        result = await self.db.execute(stmt)
        remaining_participants = result.scalars().all()
        
        # Notify remaining participants
        for p in remaining_participants:
            await manager.send_personal_message(msg_dict, p.user_id)
            
        return {"status": "success", "message": "Left group"}

    async def kick_member(self, admin_id: UUID, chat_id: UUID, target_user_id: UUID) -> dict:
        """Kick a member from group."""
        chat = await self.get_chat_details(chat_id, admin_id)
        
        if not chat.is_group:
            raise HTTPException(status_code=400, detail="Not a group chat")

        # Verify admin
        admin_p = next((p for p in chat.participants if p.user_id == admin_id), None)
        if not admin_p or admin_p.role != UserRole.admin:
            raise HTTPException(status_code=403, detail="Only admin can kick members")
            
        # Verify target is in chat
        target_p = next((p for p in chat.participants if p.user_id == target_user_id), None)
        if not target_p:
            raise HTTPException(status_code=404, detail="User not in group")

        if target_user_id == admin_id:
            raise HTTPException(status_code=400, detail="Cannot kick self")

        await self.db.delete(target_p)
        
        # Create system message
        system_msg = Message(
            conversation_id=chat_id,
            sender_id=None,
            content=f"{admin_p.user.username} removed {target_p.user.username}",
            type=MessageType.system
        )
        self.db.add(system_msg)
        await self.db.commit()
        await self.db.refresh(system_msg)
        
        # Broadcast Update
        # 1. Notify the kicked user
        kicked_msg = {
            "type": "group_event", 
            "event": "user_kicked",
            "chatId": str(chat_id),
            "userId": str(target_user_id) # The one who was kicked
        }
        await manager.send_personal_message(kicked_msg, target_user_id)

        # 2. Notify remaining participants (system message + update member list)
        sys_msg_dict = {
            "id": str(system_msg.id),
            "chatId": str(chat_id),
            "senderId": None,
            "text": system_msg.content,
            "time": system_msg.created_at.strftime("%H:%M"),
            "senderName": "System",
            "senderAvatar": None,
            "isIncoming": False,
            "type": "system"
        }
        
        # We also need to tell them to remove the member from their UI list
        update_msg = {
            "type": "group_event",
            "event": "member_removed",
            "chatId": str(chat_id),
            "userId": str(target_user_id)
        }

        for p in chat.participants:
            if p.user_id != target_user_id: # Don't send chat updates to the kicked user (they get the kick event)
                await manager.send_personal_message(sys_msg_dict, p.user_id)
                await manager.send_personal_message(update_msg, p.user_id)

        return {"status": "success", "message": "User kicked"}

    async def delete_group(self, admin_id: UUID, chat_id: UUID) -> dict:
        """Dissolve the group."""
        chat = await self.get_chat_details(chat_id, admin_id)
        
        if not chat.is_group:
            raise HTTPException(status_code=400, detail="Not a group chat")
            
        # Verify admin
        admin_p = next((p for p in chat.participants if p.user_id == admin_id), None)
        if not admin_p or admin_p.role != UserRole.admin:
            raise HTTPException(status_code=403, detail="Only admin can dissolve group")
            
        # Broadcast dissolution to all participants
        dissolve_msg = {
            "type": "group_event",
            "event": "group_dissolved",
            "chatId": str(chat_id)
        }
        
        for p in chat.participants:
            await manager.send_personal_message(dissolve_msg, p.user_id)

        await self.db.delete(chat)
        await self.db.commit()
        
    async def add_members(self, admin_id: UUID, chat_id: UUID, user_ids: List[UUID]) -> dict:
        """Add members to a group chat."""
        chat = await self.get_chat_details(chat_id, admin_id)
        
        if not chat.is_group:
            raise HTTPException(status_code=400, detail="Not a group chat")
            
        # Verify admin
        admin_p = next((p for p in chat.participants if p.user_id == admin_id), None)
        if not admin_p or admin_p.role != UserRole.admin:
            raise HTTPException(status_code=403, detail="Only admin can add members")
            
        # Filter out existing participants
        existing_ids = set(p.user_id for p in chat.participants)
        new_ids = [uid for uid in user_ids if uid not in existing_ids]
        
        if not new_ids:
             return {"status": "success", "message": "No new members to add"}

        new_participants = [
            ConversationParticipant(conversation_id=chat_id, user_id=uid, role=UserRole.member)
            for uid in new_ids
        ]
        self.db.add_all(new_participants)
        await self.db.commit()
        
        # Expire participants to force reload
        self.db.expire(chat, ['participants'])
        
        # Reload chat to get full participant details for names
        stmt = select(Conversation).where(Conversation.id == chat_id).options(
             selectinload(Conversation.participants).selectinload(ConversationParticipant.user)
        )
        result = await self.db.execute(stmt)
        chat = result.scalars().first()
        
        # Create system message
        # Fix: Convert IDs to strings for comparison to be safe
        new_ids_str = [str(uid) for uid in new_ids]
        added_users = [p.user for p in chat.participants if str(p.user_id) in new_ids_str]
        
        added_names = ", ".join([u.username for u in added_users])
        
        system_msg = Message(
            conversation_id=chat_id,
            sender_id=None,
            content=f"{admin_p.user.username} added {added_names}",
            type=MessageType.system
        )
        self.db.add(system_msg)
        await self.db.commit()
        await self.db.refresh(system_msg)

        msg_dict = {
            "id": str(system_msg.id),
            "chatId": str(chat_id),
            "senderId": None,
            "text": system_msg.content,
            "time": system_msg.created_at.strftime("%H:%M"),
            "senderName": "System",
            "senderAvatar": None,
            "isIncoming": False,
            "type": "system"
        }
        
        # Notify all participants
        for p in chat.participants:
            await manager.send_personal_message(msg_dict, p.user_id)
            
            # If this is a newly added user, send them a specific "added_to_group" event
            if str(p.user_id) in new_ids_str:
                added_event = {
                    "type": "group_event",
                    "event": "added_to_group",
                    "chatId": str(chat_id)
                }
                await manager.send_personal_message(added_event, p.user_id)
            else:
                # For existing users, update their member list
                # We need to send the new members info
                member_added_event = {
                   "type": "group_event",
                   "event": "member_added",
                   "chatId": str(chat_id),
                   "users": [
                       {
                           "id": str(u.id),
                           "username": u.username,
                           "avatar": u.avatar_url,
                           "role": "member"
                       } for u in added_users
                   ]
                }
                await manager.send_personal_message(member_added_event, p.user_id)
            
        return {"status": "success", "message": "Members added"}

    async def add_reaction(self, user_id: UUID, chat_id: UUID, message_id: UUID, emoji: str) -> dict:
        """Toggle reaction on a message."""
        # Verify chat access
        chat = await self.get_chat_details(chat_id, user_id)
        
        # Verify message exists in this chat
        stmt = select(Message).where(
            and_(
                Message.id == message_id,
                Message.conversation_id == chat_id,
                Message.is_deleted == False
            )
        )
        result = await self.db.execute(stmt)
        message = result.scalars().first()
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        # Check existing reaction
        stmt = select(MessageReaction).where(
            and_(
                MessageReaction.message_id == message_id,
                MessageReaction.user_id == user_id,
                MessageReaction.emoji == emoji
            )
        )
        result = await self.db.execute(stmt)
        existing_reaction = result.scalars().first()
        
        if existing_reaction:
            # Remove reaction
            await self.db.delete(existing_reaction)
            action = "removed"
        else:
            # Add reaction
            new_reaction = MessageReaction(
                message_id=message_id,
                user_id=user_id,
                emoji=emoji
            )
            self.db.add(new_reaction)
            action = "added"
            
        await self.db.commit()
        
        # Get updated reactions for this message to broadcast
        # Reload message with reactions
        # We need to construct the full reaction list for the UI to update fully
        
        stmt = select(MessageReaction).where(MessageReaction.message_id == message_id)
        result = await self.db.execute(stmt)
        all_reactions = result.scalars().all()
        
        # We need to broadcast the FULL state of reactions for this message to everyone
        # But wait, "userHasReacted" depends on the receiver.
        # So we can't broadcast a single static object for everyone if it contains "userHasReacted".
        # However, we can broadcast the raw list of reactions or a summary map, 
        # and let the frontend calculate "userHasReacted" if we send the list of user_ids per emoji,
        # OR we send a generic event "reaction_updated" and client re-fetches or we send careful data.
        
        # Better approach for simpler broadcast:
        # Send the event: { type: "reaction_update", messageId, emoji, action, userId }
        # Frontend can update its count locally.
        # But if we want to be robust, we should send the new count.
        
        # Let's calculate the new count for this specific emoji
        count = sum(1 for r in all_reactions if r.emoji == emoji)
        
        reaction_event = {
            "type": "reaction_update",
            "chatId": str(chat_id),
            "messageId": str(message_id),
            "emoji": emoji,
            "action": action, # "added" or "removed"
            "userId": str(user_id),
            "count": count
        }
        
        for p in chat.participants:
            await manager.send_personal_message(reaction_event, p.user_id)
            
        return {"status": "success", "action": action}


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
        current_user_role = None
        
        current_participant = next((p for p in conv.participants if p.user_id == current_user_id), None)
        if current_participant:
            current_user_role = current_participant.role

        if conv.is_group:
            name = conv.name or "Group Chat"
        else:
            if other_participants:
                other = other_participants[0].user
                name = other.username
                avatar = other.avatar_url
                other_id_str = str(other.id)
                is_online = other_id_str in manager.active_connections
                
                if other_id_str in blocked_by_ids:
                    is_blocked_by = True

        participants_dto = [
            ChatParticipant(
                id=p.user.id,
                username=p.user.username,
                avatar=p.user.avatar_url,
                role=p.role 
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
            isGroup=conv.is_group,
            participants=participants_dto,
            lastMessage=last_msg,
            time=time,
            unreadCount=unread_count,
            isOnline=is_online,
            isBlockedBy=is_blocked_by,
            role=current_user_role
        )
