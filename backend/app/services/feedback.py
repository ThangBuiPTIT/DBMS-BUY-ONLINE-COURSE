from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import is_valid_uuid


async def submit_feedback(
    db: AsyncSession, user_id: str, course_id: str, rating: int, feedback_text: str
) -> dict:
    """Gửi đánh giá khóa học. DB trigger trg_prevent_feedback_without_learning
    sẽ từ chối nếu student chưa học (progress < 10%).
    Context lưu dạng 'course:<course_id>:<course_title>' để dễ tra cứu."""

    if not is_valid_uuid(user_id) or not is_valid_uuid(course_id):
        raise ValueError("Khóa học không tồn tại")

    # Lấy course title để lưu vào context
    result = await db.execute(
        text("SELECT title FROM general_courses WHERE course_id = :cid"),
        {"cid": course_id},
    )
    course_row = result.mappings().first()
    if not course_row:
        raise ValueError("Khóa học không tồn tại")

    context = f"course:{course_id}:{course_row['title']}"

    try:
        result = await db.execute(
            text("""
                INSERT INTO user_feedbacks (user_id, rating, feedback_text, context)
                VALUES (:uid, :rating, :text, :ctx)
                RETURNING feedback_id::text, created_at
            """),
            {
                "uid": user_id,
                "rating": rating,
                "text": feedback_text or "",
                "ctx": context,
            },
        )
        row = result.mappings().first()
        await db.commit()

        return {
            "feedback_id": row["feedback_id"],
            "user_id": user_id,
            "rating": rating,
            "feedback_text": feedback_text,
            "context": context,
            "created_at": str(row["created_at"]),
        }
    except Exception as e:
        await db.rollback()
        err_msg = str(e)
        if "phải hoàn thành ít nhất" in err_msg.lower():
            raise ValueError("Bạn phải hoàn thành ít nhất 10% tiến trình học mới được phép đánh giá")
        raise ValueError(err_msg)


async def get_course_feedback(db: AsyncSession, course_id: str) -> dict:
    """Lấy danh sách đánh giá của khóa học."""
    if not is_valid_uuid(course_id):
        return {
            "feedbacks": [],
            "total": 0,
            "average_rating": 0.0,
        }

    result = await db.execute(
        text("""
            SELECT
                uf.feedback_id::text,
                uf.user_id::text,
                u.username,
                uf.rating,
                uf.feedback_text,
                uf.context,
                uf.created_at
            FROM user_feedbacks uf
            JOIN users u ON uf.user_id = u.user_id
            WHERE uf.context LIKE '%' || (SELECT title FROM general_courses WHERE course_id = :cid) || '%'
            ORDER BY uf.created_at DESC
        """),
        {"cid": course_id},
    )
    feedbacks = [dict(row) for row in result.mappings()]

    # Tính rating trung bình
    ratings = [f["rating"] for f in feedbacks if f["rating"] is not None]
    avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else 0.0

    return {
        "feedbacks": feedbacks,
        "total": len(feedbacks),
        "average_rating": avg_rating,
    }
