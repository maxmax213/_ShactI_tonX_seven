from __future__ import annotations

from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

# `bcrypt_sha256` safely supports long passwords and avoids bcrypt 72-byte limit errors.
# Keep plain bcrypt for backward compatibility with previously seeded/demo hashes.
pwd_context = CryptContext(schemes=["bcrypt_sha256", "bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(subject: str, role: str) -> str:
    settings = get_settings()
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.access_token_ttl_minutes)
    payload = {
        "sub": subject,
        "role": role,
        "exp": expires_at,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, str]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError as exc:
        raise ValueError("Invalid token") from exc

    subject = payload.get("sub")
    role = payload.get("role")
    if not subject or not role:
        raise ValueError("Malformed token")

    return {"sub": str(subject), "role": str(role)}
