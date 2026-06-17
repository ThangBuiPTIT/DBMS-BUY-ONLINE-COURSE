"""CDN / Object Storage URL resolution helper.
Database stores relative paths; this resolves them to full CDN URLs."""
from app.core.config import settings


def cdn_url(db_path: str | None, asset_type: str = "general") -> str:
    """Convert DB-stored path to full CDN URL."""
    if not db_path:
        return ""
    if db_path.startswith("http://") or db_path.startswith("https://"):
        return db_path
    cdn_base = getattr(settings, "CDN_BASE_URL", None)
    if cdn_base:
        return f"{cdn_base.rstrip('/')}/{db_path.lstrip('/')}"
    return db_path


def video_url(db_path: str | None) -> str:
    return cdn_url(db_path, "video")


def image_url(db_path: str | None) -> str:
    return cdn_url(db_path, "image")


def avatar_url(db_path: str | None) -> str:
    return cdn_url(db_path, "avatar")
