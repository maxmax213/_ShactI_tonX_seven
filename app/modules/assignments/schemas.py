from pydantic import BaseModel, ConfigDict, Field

from app.shared.enums import AssignmentType


class AssignmentCreate(BaseModel):
    lesson_id: int
    title: str = Field(min_length=3, max_length=255)
    description: str | None = None
    assignment_type: AssignmentType
    max_score: int = Field(default=100, ge=1)
    is_auto_check: bool = True
    content_payload: str | None = None


class AssignmentUpdate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: str | None = None
    assignment_type: AssignmentType
    max_score: int = Field(default=100, ge=1)
    is_auto_check: bool = True
    content_payload: str | None = None


class AssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lesson_id: int
    title: str
    description: str | None
    assignment_type: AssignmentType
    max_score: int
    is_auto_check: bool
    content_payload: str | None

