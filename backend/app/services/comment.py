from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_lesson_comments(db: AsyncSession, lesson_id: str) -> dict:
    """Lấy tất cả comment của một bài học, kèm thông tin user."""
    count_result = await db.execute(
        text("SELECT COUNT(*) FROM comments WHERE lesson_id = :lid"),
        {"lid": lesson_id},
    )
    total = count_result.scalar()

    result = await db.execute(
        text("""
            SELECT
                c.comment_id::text,
                c.lesson_id::text,
                c.user_id::text,
                u.username,
                up.avatar_url,
                c.content,
                c.created_at
            FROM comments c
            JOIN users u ON c.user_id = u.user_id
            LEFT JOIN user_profiles up ON u.user_id = up.user_id
            WHERE c.lesson_id = :lid
            ORDER BY c.created_at DESC
        """),
        {"lid": lesson_id},
    )
    comments = [dict(row) for row in result.mappings()]
    return {"comments": comments, "total": total}


async def create_comment(db: AsyncSession, lesson_id: str, user_id: str, content: str) -> dict:
    """Đăng comment mới."""
    result = await db.execute(
        text("""
            INSERT INTO comments (lesson_id, user_id, content)
            VALUES (:lid, :uid, :content)
            RETURNING comment_id::text, created_at
        """),
        {"lid": lesson_id, "uid": user_id, "content": content},
    )
    row = result.mappings().first()
    await db.commit()

    return {
        "comment_id": row["comment_id"],
        "lesson_id": lesson_id,
        "user_id": user_id,
        "content": content,
        "created_at": str(row["created_at"]),
    }


async def update_comment(db: AsyncSession, comment_id: str, user_id: str, content: str) -> None:
    """Sửa comment — chỉ chủ sở hữu."""
    result = await db.execute(
        text("""
            UPDATE comments SET content = :c
            WHERE comment_id = :cid AND user_id = :uid
        """),
        {"c": content, "cid": comment_id, "uid": user_id},
    )
    if result.rowcount == 0:
        raise ValueError("Không tìm thấy bình luận hoặc bạn không có quyền sửa")
    await db.commit()


async def delete_comment(db: AsyncSession, comment_id: str, user_id: str, is_admin: bool = False) -> None:
    """Xóa comment — chủ sở hữu hoặc admin."""
    if is_admin:
        result = await db.execute(
            text("DELETE FROM comments WHERE comment_id = :cid"),
            {"cid": comment_id},
        )
    else:
        result = await db.execute(
            text("DELETE FROM comments WHERE comment_id = :cid AND user_id = :uid"),
            {"cid": comment_id, "uid": user_id},
        )
    if result.rowcount == 0:
        raise ValueError("Không tìm thấy bình luận hoặc bạn không có quyền xóa")
    await db.commit()
