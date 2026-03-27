from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.modules.comments.models import Comment
from app.modules.comments.schemas import CommentCreate, CommentRead, CommentView
from app.modules.comments.service import comments_service
from app.modules.users.models import User
from app.shared.enums import UserRole

router = APIRouter()


@router.post("/", response_model=CommentRead)
def create_comment(
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.STUDENT, UserRole.TEACHER)),
) -> Comment:
    return comments_service.create_comment(db, current_user.id, payload)


@router.get("/assignment/{assignment_id}", response_model=list[CommentView])
def assignment_comments(assignment_id: int, db: Session = Depends(get_db)) -> list[CommentView]:
    return comments_service.list_assignment_comments(db, assignment_id)
