import uuid
from datetime import datetime, timedelta, timezone

import bcrypt


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


def create_session_key() -> str:
    return uuid.uuid4().hex


def get_session_expiry() -> datetime:
    from app.core.config import settings
    return datetime.now(timezone.utc) + timedelta(hours=settings.SESSION_EXPIRE_HOURS)


def is_valid_uuid(val: str) -> bool:
    try:
        if not val:
            return False
        uuid.UUID(str(val))
        return True
    except ValueError:
        return False
