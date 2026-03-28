from pydantic import BaseModel, Field

from app.modules.users.schemas import UserRead
from app.shared.enums import UserRole


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=255)
    role: UserRole


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead


class AuthUser(BaseModel):
    id: int
    email: str
    role: UserRole
    full_name: str
