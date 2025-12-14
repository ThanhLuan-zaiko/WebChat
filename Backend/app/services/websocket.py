"""
WebSocket Connection Manager.
Shared service for handling real-time updates.
"""
from typing import List, Dict
from uuid import UUID
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Map user_id (str) to list of active websockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: UUID | str):
        await websocket.accept()
        user_id_str = str(user_id)
        if user_id_str not in self.active_connections:
            self.active_connections[user_id_str] = []
        self.active_connections[user_id_str].append(websocket)
        # Broadcast status change to Online
        await self.broadcast_user_status(user_id_str, True)

    def disconnect(self, websocket: WebSocket, user_id: UUID | str):
        user_id_str = str(user_id)
        if user_id_str in self.active_connections:
            if websocket in self.active_connections[user_id_str]:
                self.active_connections[user_id_str].remove(websocket)
            if not self.active_connections[user_id_str]:
                del self.active_connections[user_id_str]
                
    async def disconnect_async(self, websocket: WebSocket, user_id: UUID | str):
        user_id_str = str(user_id)
        if user_id_str in self.active_connections:
            if websocket in self.active_connections[user_id_str]:
                self.active_connections[user_id_str].remove(websocket)
            if not self.active_connections[user_id_str]:
                del self.active_connections[user_id_str]
                await self.broadcast_user_status(user_id_str, False)

    async def send_personal_message(self, message: dict, user_id: UUID | str):
        user_id_str = str(user_id)
        if user_id_str in self.active_connections:
            for connection in self.active_connections[user_id_str]:
                try:
                    await connection.send_json(message)
                except Exception:
                    # Connection might be closed, should ideally be cleaned up
                    continue

    async def broadcast_user_status(self, user_id: UUID | str, is_online: bool):
        """
        Broadcast user status change to all connected users.
        """
        user_id_str = str(user_id)
        message = {
            "type": "user_status_change",
            "userId": user_id_str,
            "isOnline": is_online
        }
        
        # Iterate over all active connections
        for uid, connections in self.active_connections.items():
            if uid == user_id_str:
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
        target_ids = [str(blocker_id), str(blocked_id)]
        
        for uid in target_ids:
            if uid in self.active_connections:
                for connection in self.active_connections[uid]:
                    try:
                        await connection.send_json(message)
                    except Exception:
                        continue

manager = ConnectionManager()
