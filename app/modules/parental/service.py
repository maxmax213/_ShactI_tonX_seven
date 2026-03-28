from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.assignments.models import Assignment
from app.modules.courses.models import CourseEnrollment
from app.modules.gamification.models import Achievement, UserAchievement
from app.modules.parental.schemas import ChildAchievement, ChildDetail, ChildProgress, ChildSubmissionInfo
from app.modules.submissions.models import Submission
from app.modules.users.models import ParentStudentLink, User


class ParentalService:
    def _get_linked_student(self, db: Session, parent_id: int, student_id: int) -> User:
        link = (
            db.query(ParentStudentLink)
            .filter(
                ParentStudentLink.parent_id == parent_id,
                ParentStudentLink.student_id == student_id,
            )
            .first()
        )
        if link is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")

        student = db.get(User, student_id)
        if student is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")
        return student

    def get_children_progress(self, db: Session, parent_id: int) -> list[ChildProgress]:
        links = db.query(ParentStudentLink).filter(ParentStudentLink.parent_id == parent_id).all()
        student_ids = [link.student_id for link in links]
        if not student_ids:
            return []

        students = db.query(User).filter(User.id.in_(student_ids)).all()

        progress_list: list[ChildProgress] = []
        for student in students:
            stats_query = db.query(Submission).filter(Submission.student_id == student.id)
            total_submissions = stats_query.count()
            average_score = stats_query.with_entities(func.avg(Submission.score)).scalar() or 0
            achievements_count = (
                db.query(func.count(UserAchievement.id)).filter(UserAchievement.user_id == student.id).scalar() or 0
            )
            active_courses_count = (
                db.query(func.count(CourseEnrollment.course_id))
                .filter(CourseEnrollment.student_id == student.id)
                .scalar()
                or 0
            )

            progress_list.append(
                ChildProgress(
                    student_id=student.id,
                    student_name=student.full_name,
                    xp=student.xp,
                    level=student.level,
                    streak=student.streak,
                    achievements_count=int(achievements_count),
                    active_courses_count=int(active_courses_count),
                    total_submissions=total_submissions,
                    average_score=round(float(average_score), 2),
                )
            )

        return progress_list

    def get_child_detail(self, db: Session, parent_id: int, student_id: int) -> ChildDetail:
        student = self._get_linked_student(db, parent_id, student_id)

        stats_query = db.query(Submission).filter(Submission.student_id == student.id)
        total_submissions = stats_query.count()
        average_score = round(float(stats_query.with_entities(func.avg(Submission.score)).scalar() or 0), 2)
        achievements_count = (
            db.query(func.count(UserAchievement.id)).filter(UserAchievement.user_id == student.id).scalar() or 0
        )
        active_courses_count = (
            db.query(func.count(CourseEnrollment.course_id))
            .filter(CourseEnrollment.student_id == student.id)
            .scalar()
            or 0
        )

        achievement_rows = (
            db.query(UserAchievement, Achievement)
            .join(Achievement, Achievement.id == UserAchievement.achievement_id)
            .filter(UserAchievement.user_id == student.id)
            .order_by(UserAchievement.id.desc())
            .all()
        )
        achievements = [
            ChildAchievement(
                achievement_id=achievement.id,
                slug=achievement.slug,
                title=achievement.title,
                description=achievement.description,
                rarity=achievement.rarity,
                xp_reward=achievement.xp_reward,
            )
            for _, achievement in achievement_rows
        ]

        submission_rows = (
            db.query(Submission, Assignment)
            .join(Assignment, Assignment.id == Submission.assignment_id)
            .filter(Submission.student_id == student.id)
            .order_by(Submission.updated_at.desc(), Submission.attempt.desc(), Submission.id.desc())
            .all()
        )

        latest_by_assignment: dict[int, ChildSubmissionInfo] = {}
        for submission, assignment in submission_rows:
            if assignment.id in latest_by_assignment:
                continue
            latest_by_assignment[assignment.id] = ChildSubmissionInfo(
                submission_id=submission.id,
                assignment_id=assignment.id,
                title=assignment.title,
                assignment_type=assignment.assignment_type,
                attempt=submission.attempt,
                status=submission.status,
                score=submission.score,
                max_score=assignment.max_score,
                updated_at=submission.updated_at,
            )

        submissions = list(latest_by_assignment.values())

        return ChildDetail(
            student_id=student.id,
            student_name=student.full_name,
            xp=student.xp,
            level=student.level,
            streak=student.streak,
            achievements_count=int(achievements_count),
            active_courses_count=int(active_courses_count),
            total_submissions=total_submissions,
            average_score=average_score,
            achievements=achievements,
            submissions=submissions,
        )


parental_service = ParentalService()
