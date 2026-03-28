import secrets

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.modules.auth.schemas import LoginRequest, RegisterRequest, TokenResponse
from app.modules.courses.service import courses_service
from app.modules.users.models import User
from app.modules.users.schemas import UserRead
from app.shared.enums import UserRole


def _generate_numeric_code(length: int = 6) -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


class AuthService:
    def register(self, db: Session, payload: RegisterRequest) -> TokenResponse:
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

        # Autocomplete onboarding: new students immediately get access to a default course.
        if user.role == UserRole.STUDENT:
            courses_service.ensure_student_default_enrollment(db, user.id)

        settings = get_settings()
        token = create_access_token(str(user.id), user.role.value)
        return TokenResponse(
            access_token=token,
            expires_in=settings.access_token_ttl_minutes * 60,
            user=UserRead.model_validate(user),
        )

    def login(self, db: Session, payload: LoginRequest) -> TokenResponse:
        user = db.query(User).filter(User.email == payload.email).first()
        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Wrong email or password",
            )

        if user.role == UserRole.STUDENT:
            courses_service.ensure_student_default_enrollment(db, user.id)

        settings = get_settings()
        token = create_access_token(str(user.id), user.role.value)
        return TokenResponse(
            access_token=token,
            expires_in=settings.access_token_ttl_minutes * 60,
            user=UserRead.model_validate(user),
        )


auth_service = AuthService()
