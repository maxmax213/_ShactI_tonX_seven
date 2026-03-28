from pydantic import BaseModel, ConfigDict, Field

from app.shared.enums import UserRole


class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=255)
    role: UserRole


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: UserRole
    xp: int
    level: int
    streak: int
    parent_link_code: str | None


class ParentLinkCreate(BaseModel):
    student_id: int


class ParentLinkByCodeCreate(BaseModel):
    link_code: str = Field(min_length=4, max_length=10)


class ParentLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    parent_id: int
    student_id: int
    link_code: str


class UserStatsRead(BaseModel):
    user_id: int
    full_name: str
    xp: int
    level: int
    streak: int
    total_submissions: int
    average_score: float
