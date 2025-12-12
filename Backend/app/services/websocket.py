"""
WebSocket Connection Manager.
Shared service for handling real-time updates.
"""
from typing import List, Dict
from uuid import UUID
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Map user_id to list of active websockets (user might have multiple tabs)
        self.active_connections: Dict[UUID, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: UUID):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        # Broadcast status change to Online
        await self.broadcast_user_status(user_id, True)

    def disconnect(self, websocket: WebSocket, user_id: UUID):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                pass 
                
    async def disconnect_async(self, websocket: WebSocket, user_id: UUID):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                await self.broadcast_user_status(user_id, False)

    async def send_personal_message(self, message: dict, user_id: UUID):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    # Connection might be closed, should ideally be cleaned up
                    continue

    async def broadcast_user_status(self, user_id: UUID, is_online: bool):
        """
        Broadcast user status change to all connected users.
        """
        message = {
            "type": "user_status_change",
            "userId": str(user_id),
            "isOnline": is_online
        }
        
        # Iterate over all active connections
        for uid, connections in self.active_connections.items():
            if uid == user_id:
                continue # Don't notify self
            for connection in connections:
                try:
                    await connection.send_json(message)
                except Exception:
                    continue

    async def broadcast_block_update(self, blocker_id: UUID | str, blocked_id: UUID | str, is_blocked: bool):
        """
        Broadcast block status update to relevant users.
        """
        # Notify the blocker (optional, but good for syncing multi-tab)
        # Notify the blocked user (Crucial for UI update)
        
        message = {
            "type": "user_block_update",
            "blockerId": str(blocker_id),
            "blockedId": str(blocked_id),
            "isBlocked": is_blocked
        }
        
        # We only really need to notify the two parties involved
        target_ids = [blocker_id, blocked_id]
        
        for uid in target_ids:
            lookup_id = uid
            if isinstance(uid, str):
                try:
                    lookup_id = UUID(uid)
                except ValueError:
                    continue
            
            if lookup_id in self.active_connections:
                for connection in self.active_connections[lookup_id]:
                    try:
                        await connection.send_json(message)
                    except Exception:
                        continue

manager = ConnectionManager()
