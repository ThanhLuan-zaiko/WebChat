"""
API Dependencies.
"""
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import ValidationError

from app.core import settings, security, get_db
from app.models import User
from app.schemas import TokenPayload

# OAuth2 scheme
reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"/auth/login"
)


async def get_current_user(
    token: Annotated[str, Depends(reusable_oauth2)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Get current user from JWT token.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenPayload(sub=username)
    except (JWTError, ValidationError):
        raise credentials_exception
        
    result = await db.execute(select(User).where(User.username == token_data.sub))
    user = result.scalars().first()
    
    if user is None:
        raise credentials_exception
    return user
