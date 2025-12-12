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
from app.models.user_block import UserBlock

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


from app.services.websocket import manager

@router.post("/{user_id}/block", status_code=204)
async def block_user(
    user_id: str,
    current_user: Annotated[User, Depends(deps.get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """
    Block a user.
    """
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
        
    # Check if user exists
    user_to_block = await db.get(User, user_id)
    if not user_to_block:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Check if already blocked
    stmt = select(UserBlock).where(
        UserBlock.blocker_id == current_user.id,
        UserBlock.blocked_id == user_id
    )
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        return # Already blocked, idempotent
        
    # Create block
    block = UserBlock(blocker_id=current_user.id, blocked_id=user_id)
    db.add(block)
    await db.commit()
    
    # Broadcast update
    await manager.broadcast_block_update(current_user.id, user_id, True)


@router.delete("/{user_id}/block", status_code=204)
async def unblock_user(
    user_id: str,
    current_user: Annotated[User, Depends(deps.get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """
    Unblock a user.
    """
    stmt = select(UserBlock).where(
        UserBlock.blocker_id == current_user.id,
        UserBlock.blocked_id == user_id
    )
    result = await db.execute(stmt)
    block = result.scalar_one_or_none()
    
    if block:
        await db.delete(block)
        await db.commit()
        
        # Broadcast update
        await manager.broadcast_block_update(current_user.id, user_id, False)


@router.get("/blocked", response_model=List[UserPublic])
async def get_blocked_users(
    current_user: Annotated[User, Depends(deps.get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Any:
    """
    Get list of blocked users.
    """
    stmt = select(User).join(UserBlock, User.id == UserBlock.blocked_id).where(
        UserBlock.blocker_id == current_user.id
    )
    result = await db.execute(stmt)
    return result.scalars().all()
