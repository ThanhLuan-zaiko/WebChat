"""
User endpoints.
"""
from typing import Annotated, Any, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import get_db
from app.models import User
from app.schemas import User as UserSchema, UserPublic
from app.api import deps

router = APIRouter()

@router.get("/search", response_model=List[UserPublic])
async def search_users(
    current_user: Annotated[User, Depends(deps.get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    query: Annotated[str | None, Query(min_length=0)] = "",
) -> Any:
    """
    Search users by username or email.
    If query is empty, returns a list of suggested users.
    """
    if not query:
        # Return suggestions (exclude current user)
        stmt = select(User).where(User.id != current_user.id).limit(20)
    else:
        stmt = select(User).where(
            or_(
                User.username.ilike(f"%{query}%"),
                User.email.ilike(f"%{query}%")
            )
        ).where(User.id != current_user.id).limit(20)
    
    result = await db.execute(stmt)
    users = result.scalars().all()
    
    return users
