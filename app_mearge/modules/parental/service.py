from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.parental.schemas import ChildProgress
from app.modules.submissions.models import Submission
from app.modules.users.models import ParentStudentLink, User


class ParentalService:
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

            progress_list.append(
                ChildProgress(
                    student_id=student.id,
                    student_name=student.full_name,
                    xp=student.xp,
                    level=student.level,
                    streak=student.streak,
                    total_submissions=total_submissions,
                    average_score=round(float(average_score), 2),
                )
            )

        return progress_list


parental_service = ParentalService()
