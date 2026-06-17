from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_current_user_info(db: AsyncSession, user_id: str) -> dict | None:
    """Lấy toàn bộ thông tin user hiện tại (profile + student/teacher info)."""
    result = await db.execute(
        text("""
            SELECT
                u.user_id::text,
                u.username,
                u.email,
                r.role_name,
                u.status,
                u.created_at,
                COALESCE(up.full_name, '') AS full_name,
                up.avatar_url,
                up.phone_number,
                up.date_of_birth::text,
                s.grade_level,
                s.school_name,
                t.bio,
                t.department
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            LEFT JOIN user_profiles up ON u.user_id = up.user_id
            LEFT JOIN students s ON u.user_id = s.user_id
            LEFT JOIN teachers t ON u.user_id = t.user_id
            WHERE u.user_id = :uid AND u.is_deleted = FALSE
        """),
        {"uid": user_id},
    )
    row = result.mappings().first()
    return dict(row) if row else None


async def update_profile(db: AsyncSession, user_id: str, data) -> dict:
    """Cập nhật user_profiles. Chỉ update các field được cung cấp."""
    updates = []
    params = {"uid": user_id}

    if data.full_name is not None:
        updates.append("full_name = :fn")
        params["fn"] = data.full_name
    if data.avatar_url is not None:
        updates.append("avatar_url = :av")
        params["av"] = data.avatar_url
    if data.phone_number is not None:
        updates.append("phone_number = :pn")
        params["pn"] = data.phone_number
    if data.date_of_birth is not None:
        updates.append("date_of_birth = :dob")
        params["dob"] = data.date_of_birth

    if updates:
        await db.execute(
            text(f"UPDATE user_profiles SET {', '.join(updates)} WHERE user_id = :uid"),
            params,
        )
        await db.commit()

    return await get_current_user_info(db, user_id)


async def update_student_info(db: AsyncSession, user_id: str, data) -> dict:
    """Cập nhật students table."""
    updates = []
    params = {"uid": user_id}

    if data.grade_level is not None:
        updates.append("grade_level = :gl")
        params["gl"] = data.grade_level
    if data.school_name is not None:
        updates.append("school_name = :sn")
        params["sn"] = data.school_name

    if updates:
        await db.execute(
            text(f"UPDATE students SET {', '.join(updates)} WHERE user_id = :uid"),
            params,
        )
        await db.commit()

    return await get_current_user_info(db, user_id)


async def update_teacher_info(db: AsyncSession, user_id: str, data) -> dict:
    """Cập nhật teachers table."""
    updates = []
    params = {"uid": user_id}

    if data.bio is not None:
        updates.append("bio = :bio")
        params["bio"] = data.bio
    if data.department is not None:
        updates.append("department = :dept")
        params["dept"] = data.department

    if updates:
        await db.execute(
            text(f"UPDATE teachers SET {', '.join(updates)} WHERE user_id = :uid"),
            params,
        )
        await db.commit()

    return await get_current_user_info(db, user_id)


async def list_users(
    db: AsyncSession,
    limit: int = 20,
    offset: int = 0,
    role_id: int | None = None,
    status: str | None = None,
) -> dict:
    """Admin: danh sách users có filter + phân trang."""
    conditions = ["u.is_deleted = FALSE"]
    params = {"limit": limit, "offset": offset}

    if role_id is not None:
        conditions.append("u.role_id = :rid")
        params["rid"] = role_id
    if status is not None:
        conditions.append("u.status = :st")
        params["st"] = status

    where_clause = " AND ".join(conditions)

    count_result = await db.execute(
        text(f"SELECT COUNT(*) FROM users u WHERE {where_clause}"),
        params,
    )
    total = count_result.scalar()

    result = await db.execute(
        text(f"""
            SELECT
                u.user_id::text, u.username, u.email,
                r.role_name, u.status, u.created_at,
                COALESCE(up.full_name, '') AS full_name,
                up.avatar_url, up.phone_number, up.date_of_birth::text,
                s.grade_level, s.school_name,
                t.bio, t.department
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            LEFT JOIN user_profiles up ON u.user_id = up.user_id
            LEFT JOIN students s ON u.user_id = s.user_id
            LEFT JOIN teachers t ON u.user_id = t.user_id
            WHERE {where_clause}
            ORDER BY u.created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    )
    users = [dict(row) for row in result.mappings()]

    return {"users": users, "total": total, "limit": limit, "offset": offset}


async def get_roles(db: AsyncSession) -> list[dict]:
    """Liệt kê tất cả roles."""
    result = await db.execute(
        text("SELECT role_id, role_name FROM roles ORDER BY role_id")
    )
    return [dict(row) for row in result.mappings()]
