from fastapi import APIRouter

from app.modules.assignments.router import router as assignments_router
from app.modules.auth.router import router as auth_router
from app.modules.comments.router import router as comments_router
from app.modules.courses.router import router as courses_router
from app.modules.gamification.router import router as gamification_router
from app.modules.parental.router import router as parental_router
from app.modules.submissions.router import router as submissions_router
from app.modules.surveys.router import router as surveys_router
from app.modules.users.router import router as users_router

api_router = APIRouter()


@api_router.get("/health", tags=["system"])
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(courses_router, prefix="/courses", tags=["courses"])
api_router.include_router(assignments_router, prefix="/assignments", tags=["assignments"])
api_router.include_router(submissions_router, prefix="/submissions", tags=["submissions"])
api_router.include_router(comments_router, prefix="/comments", tags=["comments"])
api_router.include_router(gamification_router, prefix="/gamification", tags=["gamification"])
api_router.include_router(parental_router, prefix="/parental", tags=["parental"])
api_router.include_router(surveys_router, prefix="/surveys", tags=["surveys"])

