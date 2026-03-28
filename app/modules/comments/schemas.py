from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CommentCreate(BaseModel):
    assignment_id: int
    content: str = Field(min_length=1, max_length=3000)
    parent_comment_id: int | None = None


class CommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    assignment_id: int
    author_id: int
    parent_comment_id: int | None
    content: str
    created_at: datetime
    updated_at: datetime


class CommentView(BaseModel):
    id: int
    assignment_id: int
    author_id: int
    author_name: str
    author_xp: int
    author_level: int
    parent_comment_id: int | None
    content: str
    created_at: datetime
