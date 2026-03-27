import os
import argparse

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


class DatabaseManager:
    def __init__(self, metadata=None, db_url=None, run_migrations=True):
        if metadata is None:
            try:
                from .db import Base
            except ImportError:
                from db import Base
            metadata = Base.metadata

        self.metadata = metadata
        self.db_url = db_url or self._build_db_url()

        print("[БД] Инициализация подключения...")
        try:
            self.engine = create_engine(
                self.db_url,
                pool_size=int(os.getenv("DB_POOL_SIZE", "10")),
                max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "20")),
                pool_pre_ping=True,
                echo=os.getenv("DB_ECHO", "False").lower() == "true",
            )
            with self.engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            print("[БД] Подключение к БД успешно.")
        except Exception as error:
            raise RuntimeError(f"Ошибка подключения к БД: {error}") from error

        self.SessionLocal = sessionmaker(
            bind=self.engine,
            autocommit=False,
            autoflush=False,
        )

        if run_migrations:
            self.apply_migrations()

    def _build_db_url(self):
        return (
            f"postgresql://{os.getenv('DB_USER', 'postgres')}:"
            f"{os.getenv('DB_PASSWORD', 'password')}@"
            f"{os.getenv('DB_HOST', 'localhost')}:"
            f"{os.getenv('DB_PORT', '5432')}/"
            f"{os.getenv('DB_NAME', 'education_db')}"
        )

    def get_session(self):
        return self.SessionLocal()

    def apply_migrations(self):
        print("[Миграции] Запуск пересоздания схемы...")
        try:
            self.metadata.drop_all(self.engine)
            print("[Миграции] Старые таблицы удалены.")
            self.metadata.create_all(self.engine)
            print("[Миграции] Таблицы созданы заново.")
        except Exception as error:
            raise RuntimeError(f"Ошибка выполнения миграций: {error}") from error

    def close(self):
        self.engine.dispose()
        print("[БД] Соединение с БД закрыто.")


def _parse_args():
    parser = argparse.ArgumentParser(description="Запуск миграций (drop_all + create_all)")
    parser.add_argument(
        "--no-migrate",
        action="store_true",
        help="Только проверить подключение к БД, без миграций",
    )
    return parser.parse_args()


def main():
    args = _parse_args()
    manager = DatabaseManager(run_migrations=not args.no_migrate)
    manager.close()


if __name__ == "__main__":
    main()
