from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from datetime import datetime
from models.user import UserRole
import uuid


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    org_id: Optional[str] = None
    role: UserRole = UserRole.RESEARCHER


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    email: str
    org_id: Optional[str]
    role: UserRole
    created_at: datetime


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None