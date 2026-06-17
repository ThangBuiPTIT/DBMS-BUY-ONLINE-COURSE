"""Keyset (cursor-based) pagination utilities — replaces OFFSET for deep pages."""
import base64
from typing import Any


def encode_cursor(value: Any) -> str:
    """Encode a cursor value to opaque base64 string."""
    return base64.urlsafe_b64encode(str(value).encode()).decode().rstrip("=")


def decode_cursor(cursor: str) -> str:
    """Decode cursor back to original string value."""
    padding = 4 - len(cursor) % 4
    if padding != 4:
        cursor += "=" * padding
    return base64.urlsafe_b64decode(cursor.encode()).decode()


class CursorPage:
    """Generic cursor-based page result."""

    def __init__(self, items: list[dict], next_cursor: str | None, has_more: bool):
        self.items = items
        self.next_cursor = next_cursor
        self.has_more = has_more

    def to_response(self) -> dict:
        return {
            "items": self.items,
            "next_cursor": self.next_cursor,
            "has_more": self.has_more,
        }
