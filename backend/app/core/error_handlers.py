"""Global exception handlers — consistent error responses, no raw DB traces."""
import logging
import uuid

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger("app")


async def integrity_error_handler(request: Request, exc: IntegrityError):
    """Map DB constraint violations to user-friendly HTTP errors."""
    orig = str(exc.orig) if exc.orig else str(exc)
    if "uq_student_course_enrollment" in orig or "uq_" in orig.lower():
        return JSONResponse(status_code=409, content={"detail": "Dữ liệu đã tồn tại"})
    if "fk_" in orig.lower() or "foreign key" in orig.lower():
        return JSONResponse(status_code=400, content={"detail": "Dữ liệu tham chiếu không tồn tại"})
    if "ck_" in orig.lower() or "check" in orig.lower():
        return JSONResponse(status_code=400, content={"detail": "Dữ liệu không hợp lệ"})
    error_id = str(uuid.uuid4())[:8]
    logger.error(f"[{error_id}] IntegrityError: {orig}")
    return JSONResponse(status_code=500, content={"detail": f"Lỗi hệ thống (ID: {error_id})"})


async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all: log the real error, return sanitized response."""
    error_id = str(uuid.uuid4())[:8]
    logger.error(f"[{error_id}] Unhandled: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Lỗi hệ thống (ID: {error_id}). Vui lòng liên hệ hỗ trợ."},
    )
