from app.core.database import SessionLocal, init_db
from app.core.bootstrap import ensure_demo_data


def run_seed() -> None:
    init_db()
    db = SessionLocal()
    try:
        ensure_demo_data(db)
    finally:
        db.close()

    print("Демо-данные готовы")
    print("Учитель: teacher@demo.local / teacher123")
    print("Ученик : student@demo.local / student123")
    print("Родитель: parent@demo.local / parent123")
    print("Код курса: 654321")
    print("Код привязки родителя: 123456")


if __name__ == "__main__":
    run_seed()
