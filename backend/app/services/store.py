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


# ── Phase 4: Refund & Transactions ──

async def refund_course(db: AsyncSession, student_id: str, course_id: str, reason: str = "") -> None:
    """Admin hoàn tiền khóa học. Gọi sp_refund_course với advisory lock chống race condition."""
    try:
        import uuid as _uuid
        course_int = _uuid.UUID(course_id).int % (2**63 - 1)
        await db.execute(
            text("SELECT pg_advisory_xact_lock(:lock_id)"),
            {"lock_id": course_int},
        )

        await db.execute(
            text("CALL sp_refund_course(:sid, :cid)"),
            {"sid": student_id, "cid": course_id},
        )
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise StoreError(str(e), 500)


async def get_user_transactions(
    db: AsyncSession, user_id: str, limit: int = 20, offset: int = 0
) -> dict:
    """Lịch sử giao dịch của một user — cả tiền gửi và nhận."""
    count_result = await db.execute(
        text("""
            SELECT COUNT(*) FROM transaction_logs
            WHERE (from_wallet_user_id = :uid OR to_wallet_user_id = :uid)
              AND status = 'SUCCESS'
        """),
        {"uid": user_id},
    )
    total = count_result.scalar()

    result = await db.execute(
        text("""
            SELECT
                tl.transaction_id::text,
                tl.created_at,
                tl.amount,
                tl.status,
                tl.message,
                CASE
                    WHEN tl.from_wallet_user_id = :uid THEN 'OUT'
                    ELSE 'IN'
                END AS direction,
                c.title AS related_course,
                CASE
                    WHEN tl.from_wallet_user_id = :uid THEN
                        COALESCE(
                            (SELECT full_name FROM user_profiles WHERE user_id = tl.to_wallet_user_id),
                            'Hệ thống'
                        )
                    ELSE
                        COALESCE(
                            (SELECT full_name FROM user_profiles WHERE user_id = tl.from_wallet_user_id),
                            'Hệ thống'
                        )
                END AS counterparty_name
            FROM transaction_logs tl
            LEFT JOIN general_courses c ON tl.related_course_id = c.course_id
            WHERE (tl.from_wallet_user_id = :uid OR tl.to_wallet_user_id = :uid)
              AND tl.status = 'SUCCESS'
            ORDER BY tl.created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        {"uid": user_id, "limit": limit, "offset": offset},
    )

    return {
        "transactions": [dict(row) for row in result.mappings()],
        "total": total,
        "limit": limit,
        "offset": offset,
    }
