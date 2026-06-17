from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_notifications(db: AsyncSession, user_id: str) -> list[dict]:
    """Get notifications for a user (last 30 days, partition-pruned)."""
    result = await db.execute(
        text("""
            SELECT
                notification_id::text,
                user_id::text,
                title,
                message,
                is_read,
                created_at
            FROM notification_users
            WHERE user_id = :uid AND created_at >= NOW() - INTERVAL '30 days'
            ORDER BY is_read ASC, created_at DESC
        """),
        {"uid": user_id},
    )
    return [dict(row) for row in result.mappings()]


async def mark_notification_as_read(db: AsyncSession, notification_id: str) -> None:
    """Mark a notification as read (two-step for partition key)."""
    # Step 1: Get partition key (created_at)
    result = await db.execute(
        text("""
            SELECT created_at
            FROM notification_users
            WHERE notification_id = :nid AND created_at >= NOW() - INTERVAL '30 days'
            LIMIT 1
        """),
        {"nid": notification_id},
    )
    row = result.mappings().first()
    if row is None:
        raise ValueError("thông báo không tồn tại hoặc đã quá hạn")

    # Step 2: Update with partition key
    await db.execute(
        text("""
            UPDATE notification_users
            SET is_read = TRUE
            WHERE notification_id = :nid AND created_at = :cat
        """),
        {"nid": notification_id, "cat": row["created_at"]},
    )
    await db.commit()


async def get_audit_logs(db: AsyncSession) -> list[dict]:
    """Get recent 50 audit logs (partition-pruned)."""
    result = await db.execute(
        text("""
            SELECT
                audit_id::text,
                run_id::text,
                action,
                status,
                COALESCE(error_message, '') AS error_message,
                created_at
            FROM audit_logs
            WHERE created_at >= NOW() - INTERVAL '30 days'
            ORDER BY created_at DESC
            LIMIT 50
        """)
    )
    return [dict(row) for row in result.mappings()]
