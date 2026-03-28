from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.assignments.models import Assignment
from app.modules.comments.models import Comment
from app.modules.comments.schemas import CommentCreate, CommentView
from app.modules.users.models import User


class CommentsService:
    def create_comment(self, db: Session, author_id: int, payload: CommentCreate) -> Comment:
        assignment = db.get(Assignment, payload.assignment_id)
        if assignment is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

        comment = Comment(
            assignment_id=payload.assignment_id,
            author_id=author_id,
            parent_comment_id=payload.parent_comment_id,
            content=payload.content,
        )
        db.add(comment)
        db.commit()
        db.refresh(comment)
        return comment

    def list_assignment_comments(self, db: Session, assignment_id: int) -> list[CommentView]:
        comments = (
            db.query(Comment)
            .filter(Comment.assignment_id == assignment_id)
            .order_by(Comment.id.asc())
            .all()
        )

        author_ids = {comment.author_id for comment in comments}
        users = db.query(User).filter(User.id.in_(author_ids)).all() if author_ids else []
        user_map = {user.id: user for user in users}

        return [
            CommentView(
                id=comment.id,
                assignment_id=comment.assignment_id,
                author_id=comment.author_id,
                author_name=user_map.get(comment.author_id).full_name if comment.author_id in user_map else "Unknown",
                author_xp=user_map.get(comment.author_id).xp if comment.author_id in user_map else 0,
                author_level=user_map.get(comment.author_id).level if comment.author_id in user_map else 1,
                parent_comment_id=comment.parent_comment_id,
                content=comment.content,
                created_at=comment.created_at,
            )
            for comment in comments
        ]


comments_service = CommentsService()
