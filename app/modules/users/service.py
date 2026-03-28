import secrets

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.modules.submissions.models import Submission
from app.modules.users.models import ParentStudentLink, User
from app.modules.users.schemas import ParentLinkByCodeCreate, ParentLinkCreate, UserCreate, UserStatsRead
from app.shared.enums import UserRole


def _generate_numeric_code(length: int = 6) -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


class UserService:
    def create_user(self, db: Session, payload: UserCreate) -> User:
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already exists",
            )

        parent_link_code = None
        if payload.role == UserRole.STUDENT:
            while True:
                candidate = _generate_numeric_code()
                if not db.query(User).filter(User.parent_link_code == candidate).first():
                    parent_link_code = candidate
                    break

        user = User(
            email=payload.email,
            password_hash=hash_password(payload.password),
            full_name=payload.full_name,
            role=payload.role,
            parent_link_code=parent_link_code,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def list_users(self, db: Session, role: UserRole | None = None) -> list[User]:
        query = db.query(User)
        if role is not None:
            query = query.filter(User.role == role)
        return query.order_by(User.id.desc()).all()

    def create_parent_link(
        self,
        db: Session,
        parent_id: int,
        payload: ParentLinkCreate,
    ) -> ParentStudentLink:
        student = db.get(User, payload.student_id)
        if student is None or student.role != UserRole.STUDENT:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found",
            )

        existing = db.get(ParentStudentLink, (parent_id, payload.student_id))
        if existing:
            return existing

        link = ParentStudentLink(
            parent_id=parent_id,
            student_id=payload.student_id,
            link_code=student.parent_link_code or _generate_numeric_code(),
        )
        db.add(link)
        db.commit()
        db.refresh(link)
        return link

    def create_parent_link_by_code(
        self,
        db: Session,
        parent_id: int,
        payload: ParentLinkByCodeCreate,
    ) -> ParentStudentLink:
        student = (
            db.query(User)
            .filter(
                User.role == UserRole.STUDENT,
                User.parent_link_code == payload.link_code,
            )
            .first()
        )
        if student is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ребенок с таким кодом не найден",
            )

        return self.create_parent_link(db, parent_id, ParentLinkCreate(student_id=student.id))

    def user_stats(self, db: Session, user_id: int) -> UserStatsRead:
        user = db.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        submissions_query = db.query(Submission).filter(Submission.student_id == user_id)
        total_submissions = submissions_query.count()
        average_score = submissions_query.with_entities(func.avg(Submission.score)).scalar() or 0

        return UserStatsRead(
            user_id=user.id,
            full_name=user.full_name,
            xp=user.xp,
            level=user.level,
            streak=user.streak,
            total_submissions=total_submissions,
            average_score=round(float(average_score), 2),
        )


user_service = UserService()
