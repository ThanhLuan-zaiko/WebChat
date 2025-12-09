"""
Auth endpoints.
"""
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security, get_db
from app.models import User
from app.schemas import Token, UserCreate, User as UserSchema
from app.api import deps

router = APIRouter()


@router.post("/login", response_model=Token)
async def login_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests.
    """
    # Find user by username or email
    result = await db.execute(
        select(User).where(
            (User.username == form_data.username) | (User.email == form_data.username)
        )
    )
    user = result.scalars().first()
    
    # Verify password
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect username or password",
        )
        
    # Generate token
    access_token_expires = security.timedelta(minutes=security.settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        subject=user.username, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer"
    }


@router.post("/register", response_model=UserSchema)
async def register(
    user_in: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Any:
    """
    Register a new user.
    """
    # Check if user exists
    result = await db.execute(select(User).where(User.username == user_in.username))
    if result.scalars().first():
        raise HTTPException(
            status_code=400,
            detail="Username already registered",
        )
        
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalars().first():
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )
        
    # Create user
    user = User(
        username=user_in.username,
        email=user_in.email,
        password_hash=security.get_password_hash(user_in.password),
        avatar_url=user_in.avatar_url,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/me", response_model=UserSchema)
def read_users_me(
    current_user: Annotated[User, Depends(deps.get_current_user)],
) -> Any:
    """
    Get current user.
    """
    return current_user
