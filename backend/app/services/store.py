from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.isolation import serializable
from app.core.pagination import CursorPage, decode_cursor, encode_cursor
from app.core.security import is_valid_uuid


async def get_store_courses(db: AsyncSession, student_id: str) -> list[dict]:
    """Get published courses for the storefront using v_published_courses view."""
    clean_sid = student_id if is_valid_uuid(student_id) else "00000000-0000-0000-0000-000000000000"
    result = await db.execute(
        text("""
            SELECT
                v.course_id::text,
                v.title,
                v.description,
                v.image_url,
                v.price,
                'PUBLISHED' AS visibility_status,
                v.category_name,
                v.teacher_name,
                v.enrollment_count,
                v.updated_at,
                EXISTS(
                    SELECT 1 FROM course_enrollments e
                    WHERE e.course_id = v.course_id AND e.student_id = :sid
                ) AS is_enrolled
            FROM v_published_courses v
            ORDER BY v.updated_at DESC
        """),
        {"sid": clean_sid},
    )
    return [dict(row) for row in result.mappings()]


async def get_wallet(db: AsyncSession, user_id: str) -> dict:
    """Get wallet balance. Auto-creates wallet with 0 balance if not found."""
    if not is_valid_uuid(user_id):
        return {"user_id": user_id, "balance": 0.0, "updated_at": None}

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
    if not is_valid_uuid(user_id):
        raise StoreError("User không tồn tại", 400)
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
    if not is_valid_uuid(student_id) or not is_valid_uuid(course_id):
        raise StoreError("ID không hợp lệ", 400)
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
    if not is_valid_uuid(student_id) or not is_valid_uuid(course_id):
        raise StoreError("ID không hợp lệ", 400)
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


# ── Phase 3: Transfer & SERIALIZABLE Checkout ──

async def transfer_funds(
    db: AsyncSession, from_user_id: str, to_user_id: str, amount: float, message: str = ""
) -> dict:
    """Chuyển tiền giữa 2 user với SERIALIZABLE isolation + deadlock prevention."""
    if not is_valid_uuid(from_user_id) or not is_valid_uuid(to_user_id):
        raise StoreError("ID không hợp lệ", 400)

    async with serializable(db):
        try:
            await db.execute(
                text("CALL sp_transfer_funds(:fid, :tid, :amt, :msg)"),
                {"fid": from_user_id, "tid": to_user_id, "amt": amount, "msg": message or f"Chuyen {amount}"},
            )
            return {"from": from_user_id, "to": to_user_id, "amount": amount, "status": "SUCCESS"}
        except Exception as e:
            err_msg = str(e)
            if "Số dư không đủ" in err_msg:
                raise StoreError("Số dư không đủ", 400)
            if "tự chuyển" in err_msg.lower():
                raise StoreError("Không thể tự chuyển tiền", 400)
            raise StoreError(err_msg, 500)


async def checkout_course_v2(db: AsyncSession, student_id: str, course_id: str) -> dict:
    """Buy course using sp_enroll_paid_course with SERIALIZABLE isolation."""
    if not is_valid_uuid(student_id) or not is_valid_uuid(course_id):
        raise StoreError("ID không hợp lệ", 400)

    async with serializable(db):
        try:
            await db.execute(
                text("CALL sp_enroll_paid_course(:sid, :cid)"),
                {"sid": student_id, "cid": course_id},
            )
            return {"message": "Đăng ký khóa học thành công", "status": "SUCCESS"}
        except Exception as e:
            err_msg = str(e)
            if "Số dư không đủ" in err_msg:
                raise StoreError("Số dư không đủ để mua khóa học này", 400)
            if "không tồn tại" in err_msg.lower():
                raise StoreError("Khóa học không tồn tại hoặc chưa publish", 400)
            if "miễn phí" in err_msg.lower():
                raise StoreError("Khóa học miễn phí — không cần thanh toán", 400)
            if "đã đăng ký" in err_msg.lower() or "duplicate" in err_msg.lower():
                raise StoreError("Bạn đã đăng ký khóa học này", 409)
            raise StoreError(err_msg, 500)


# ── Phase 4: Keyset Pagination ──

async def get_user_transactions_cursor(
    db: AsyncSession, user_id: str, limit: int = 20, cursor: str | None = None
) -> CursorPage:
    """Lịch sử giao dịch với keyset pagination (cursor-based)."""
    if not is_valid_uuid(user_id):
        return CursorPage([], None, False)

    cursor_ts = None
    if cursor:
        try:
            cursor_ts = decode_cursor(cursor)
        except Exception:
            cursor_ts = None

    if cursor_ts:
        result = await db.execute(
            text("""
                SELECT tl.transaction_id::text, tl.created_at, tl.amount, tl.status, tl.message,
                       CASE WHEN tl.from_wallet_user_id = :uid THEN 'OUT' ELSE 'IN' END AS direction
                FROM transaction_logs tl
                WHERE (tl.from_wallet_user_id = :uid OR tl.to_wallet_user_id = :uid)
                  AND tl.status = 'SUCCESS' AND tl.created_at < :cursor_ts
                ORDER BY tl.created_at DESC LIMIT :limit
            """),
            {"uid": user_id, "cursor_ts": cursor_ts, "limit": limit + 1},
        )
    else:
        result = await db.execute(
            text("""
                SELECT tl.transaction_id::text, tl.created_at, tl.amount, tl.status, tl.message,
                       CASE WHEN tl.from_wallet_user_id = :uid THEN 'OUT' ELSE 'IN' END AS direction
                FROM transaction_logs tl
                WHERE (tl.from_wallet_user_id = :uid OR tl.to_wallet_user_id = :uid)
                  AND tl.status = 'SUCCESS'
                ORDER BY tl.created_at DESC LIMIT :limit
            """),
            {"uid": user_id, "limit": limit + 1},
        )

    rows = [dict(row) for row in result.mappings()]
    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]

    next_cursor = None
    if has_more and rows:
        last_ts = rows[-1]["created_at"]
        next_cursor = encode_cursor(last_ts.isoformat())

    return CursorPage(rows, next_cursor, has_more)


async def get_user_transactions(
    db: AsyncSession, user_id: str, limit: int = 20, offset: int = 0
) -> dict:
    """Lịch sử giao dịch của một user — cả tiền gửi và nhận."""
    if not is_valid_uuid(user_id):
        return {
            "transactions": [],
            "total": 0,
            "limit": limit,
            "offset": offset,
        }

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
