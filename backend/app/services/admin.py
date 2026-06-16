from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


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
