from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_store_courses(db: AsyncSession, student_id: str) -> list[dict]:
    """Get published courses for the storefront."""
    result = await db.execute(
        text("""
            SELECT
                c.course_id::text,
                c.title,
                COALESCE(c.description, '') AS description,
                COALESCE(c.image_url, '') AS image_url,
                c.price,
                c.visibility_status,
                COALESCE(up.full_name, 'Giảng viên') AS teacher_name,
                EXISTS(SELECT 1 FROM course_enrollments e
                       WHERE e.course_id = c.course_id AND e.student_id = :student_id) AS is_enrolled
            FROM general_courses c
            LEFT JOIN user_profiles up ON c.teacher_id = up.user_id
            WHERE c.visibility_status = 'PUBLISHED' AND c.is_deleted = FALSE
            ORDER BY c.updated_at DESC
        """),
        {"student_id": student_id},
    )
    return [dict(row) for row in result.mappings()]


async def get_wallet(db: AsyncSession, user_id: str) -> dict:
    """Get wallet balance. Auto-creates wallet with 0 balance if not found."""
    result = await db.execute(
        text("SELECT user_id::text, balance, updated_at FROM wallets WHERE user_id = :uid"),
        {"uid": user_id},
    )
    row = result.mappings().first()
    if row:
        return dict(row)

    # Auto-create wallet with 0 balance (match Go behavior)
    await db.execute(
        text("INSERT INTO wallets (user_id, balance) VALUES (:uid, 0) ON CONFLICT (user_id) DO NOTHING"),
        {"uid": user_id},
    )
    await db.commit()

    return {"user_id": user_id, "balance": 0.0, "updated_at": None}


async def topup_wallet(db: AsyncSession, user_id: str, amount: float, message: str) -> None:
    """Top up wallet by calling sp_topup_wallet procedure."""
    await db.execute(
        text("CALL sp_topup_wallet(:uid, :amt, :msg)"),
        {"uid": user_id, "amt": amount, "msg": message},
    )
    await db.commit()


class StoreError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code


async def checkout_course(db: AsyncSession, student_id: str, course_id: str) -> None:
    """Buy a course using wallet balance. Calls sp_buy_course_with_wallet."""
    try:
        await db.execute(
            text("CALL sp_buy_course_with_wallet(:sid, :cid)"),
            {"sid": student_id, "cid": course_id},
        )
        await db.commit()
    except Exception as e:
        await db.rollback()
        err_msg = str(e)
        if "Số dư không đủ" in err_msg:
            raise StoreError("Số dư không đủ để mua khóa học này", 400)
        if "Khóa học không tồn tại" in err_msg:
            raise StoreError("Khóa học không tồn tại", 400)
        raise StoreError(err_msg, 500)
