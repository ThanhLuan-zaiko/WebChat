from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    username: str
    avatar_url: str | None = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserUpdate(UserBase):
    password: str | None = None


class UserPasswordUpdate(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6)


class UserInDB(UserBase):
    id: UUID
    
    class Config:
        from_attributes = True



class UserPublic(UserBase):
    id: UUID
    
    class Config:
        from_attributes = True

class User(UserInDB):
    pass
