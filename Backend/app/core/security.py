"""
Security utilities (Password hashing, JWT).
"""
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import jwt

from app.core.config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    # bcrypt.checkpw requires bytes
    password_bytes = plain_password.encode('utf-8')
    hash_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hash_bytes)


def get_password_hash(password: str) -> str:
    """Generate a password hash."""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def create_access_token(subject: str | Any, expires_delta: timedelta | None = None) -> str:
    """Create a JWT access token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt
