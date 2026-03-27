from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.shared.enums import SubmissionStatus


class SubmissionCreate(BaseModel):
    solution_payload: str = Field(min_length=1)


class SubmissionGrade(BaseModel):
    score: int = Field(ge=0, le=100)
    teacher_feedback: str | None = None


class SubmissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    assignment_id: int
    student_id: int
    attempt: int
    solution_payload: str
    status: SubmissionStatus
    score: int | None
    teacher_feedback: str | None
    created_at: datetime
    updated_at: datetime
