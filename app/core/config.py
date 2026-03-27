import os
from functools import lru_cache

from pydantic import BaseModel, Field
from dotenv import load_dotenv

try:
    load_dotenv(encoding="utf-8")
except UnicodeDecodeError:
    load_dotenv(encoding="cp1251")


class Settings(BaseModel):
    app_name: str = os.getenv("APP_NAME", "Edu Platform API")
    environment: str = os.getenv("ENVIRONMENT", "development")

    db_user: str = os.getenv("DB_USER", "postgres")
    db_password: str = os.getenv("DB_PASSWORD", "password")
    db_host: str = os.getenv("DB_HOST", "localhost")
    db_port: str = os.getenv("DB_PORT", "5432")
    db_name: str = os.getenv("DB_NAME", "education_db")

    access_token_ttl_minutes: int = int(os.getenv("ACCESS_TOKEN_TTL_MINUTES", "60"))
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    seed_demo_data: bool = os.getenv("SEED_DEMO_DATA", "true").strip().lower() == "true"

    cors_origins: list[str] = Field(
        default_factory=lambda: [
            origin.strip().rstrip("/")
            for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
            if origin.strip()
        ]
    )

    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.db_user}:{self.db_password}@"
            f"{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
