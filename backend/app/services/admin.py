from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import is_valid_uuid


async def get_transactions(
    db: AsyncSession, limit: int = 10, offset: int = 0
) -> dict:
    """Get paginated transaction list from vw_detailed_transaction_history."""
    count_result = await db.execute(
        text("SELECT COUNT(*) FROM vw_detailed_transaction_history")
    )
    total_count = count_result.scalar()

    result = await db.execute(
        text("""
            SELECT
                v.transaction_id::text,
                v.created_at,
                v.amount,
                v.status,
                v.message,
                v.sender_name,
                v.receiver_name,
                v.related_course,
                u_sender.user_id::text AS sender_id,
                u_receiver.user_id::text AS receiver_id
            FROM vw_detailed_transaction_history v
            LEFT JOIN user_profiles u_sender ON v.sender_name = u_sender.full_name
            LEFT JOIN user_profiles u_receiver ON v.receiver_name = u_receiver.full_name
            LIMIT :limit OFFSET :offset
        """),
        {"limit": limit, "offset": offset},
    )

    transactions = []
    for row in result.mappings():
        transactions.append(dict(row))

    return {
        "transactions": transactions,
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
    }


async def get_revenue(db: AsyncSession) -> list[dict]:
    """Get revenue by course from vw_revenue_by_course."""
    result = await db.execute(
        text("""
            SELECT course_id::text, title, price, total_sales_count, total_revenue
            FROM vw_revenue_by_course
            ORDER BY total_revenue DESC
        """)
    )
    return [dict(row) for row in result.mappings()]


async def ban_user(db: AsyncSession, user_id: str, reason: str) -> None:
    """Ban a user by calling sp_ban_user procedure."""
    await db.execute(
        text("CALL sp_ban_user(:user_id, :reason)"),
        {"user_id": user_id, "reason": reason},
    )
    await db.commit()


# ── Phase 4: Wallet Audit & Completion Rate ──

async def audit_wallet_balance(db: AsyncSession, user_id: str) -> dict:
    """Đối chiếu số dư ví với transaction logs để phát hiện gian lận.
    Gọi fn_get_user_real_balance()."""
    if not is_valid_uuid(user_id):
        return {
            "user_id": user_id,
            "wallet_balance": 0.0,
            "computed_balance": 0.0,
            "discrepancy": 0.0,
            "is_consistent": True,
        }

    wallet_result = await db.execute(
        text("SELECT balance FROM wallets WHERE user_id = :uid"),
        {"uid": user_id},
    )
    wallet_row = wallet_result.mappings().first()
    wallet_balance = float(wallet_row["balance"]) if wallet_row else 0.0

    real_result = await db.execute(
        text("SELECT fn_get_user_real_balance(:uid)"),
        {"uid": user_id},
    )
    real_balance = float(real_result.scalar() or 0)

    discrepancy = round(wallet_balance - real_balance, 2)

    return {
        "user_id": user_id,
        "wallet_balance": wallet_balance,
        "computed_balance": real_balance,
        "discrepancy": discrepancy,
        "is_consistent": discrepancy == 0,
    }


async def get_course_completion_rate(db: AsyncSession, course_id: str) -> dict:
    """Tỷ lệ hoàn thành khóa học. Gọi fn_get_course_completion_rate()."""
    if not is_valid_uuid(course_id):
        raise ValueError("Khóa học không tồn tại")

    result = await db.execute(
        text("""
            SELECT
                c.course_id::text,
                c.title AS course_title,
                (SELECT COUNT(*) FROM course_enrollments WHERE course_id = :cid) AS total_enrolled,
                (SELECT COUNT(*) FROM course_enrollments WHERE course_id = :cid AND progress = 100) AS completed,
                fn_get_course_completion_rate(:cid) AS completion_rate
            FROM general_courses c
            WHERE c.course_id = :cid AND c.is_deleted = FALSE
        """),
        {"cid": course_id},
    )
    row = result.mappings().first()
    if row is None:
        raise ValueError("Khóa học không tồn tại")
    return dict(row)
