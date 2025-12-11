from fastapi import APIRouter
from app.api.endpoints import auth, users, chats, uploads

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(chats.router, prefix="/chats", tags=["chats"])
api_router.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
