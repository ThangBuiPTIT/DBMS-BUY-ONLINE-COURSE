import uuid
from datetime import datetime, timedelta, timezone

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


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
