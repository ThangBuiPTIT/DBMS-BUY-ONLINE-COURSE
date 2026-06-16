from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_course_content(db: AsyncSession, course_id: str) -> dict:
    """Get full course content tree (modules → lessons → materials)."""
    # 1. Course info
    result = await db.execute(
        text("""
            SELECT course_id::text, title, visibility_status
            FROM general_courses
            WHERE course_id = :cid AND is_deleted = FALSE
        """),
        {"cid": course_id},
    )
    course_row = result.mappings().first()
    if course_row is None:
        raise ValueError("course not found")
    course = dict(course_row)

    # 2. Modules
    result = await db.execute(
        text("""
            SELECT module_id::text, course_id::text, title, order_index
            FROM general_course_modules
            WHERE course_id = :cid
            ORDER BY order_index ASC
        """),
        {"cid": course_id},
    )
    modules_list = [dict(row) for row in result.mappings()]
    modules_map = {m["module_id"]: m for m in modules_list}
    for m in modules_list:
        m["lessons"] = []

    # 3. Lessons
    result = await db.execute(
        text("""
            SELECT lesson_id::text, module_id::text, title,
                   COALESCE(video_url, '') AS video_url, order_index
            FROM general_course_lessons
            WHERE module_id IN (
                SELECT module_id FROM general_course_modules WHERE course_id = :cid
            )
            ORDER BY order_index ASC
        """),
        {"cid": course_id},
    )
    lessons_list = [dict(row) for row in result.mappings()]
    lessons_map = {l["lesson_id"]: l for l in lessons_list}
    for l in lessons_list:
        l["materials"] = []

    # 4. Materials
    result = await db.execute(
        text("""
            SELECT material_id::text, lesson_id::text, title, content_url
            FROM learning_materials
            WHERE lesson_id IN (
                SELECT lesson_id FROM general_course_lessons WHERE module_id IN (
                    SELECT module_id FROM general_course_modules WHERE course_id = :cid
                )
            )
        """),
        {"cid": course_id},
    )
    materials_list = [dict(row) for row in result.mappings()]

    # Nest materials → lessons → modules
    for mat in materials_list:
        if mat["lesson_id"] in lessons_map:
            lessons_map[mat["lesson_id"]]["materials"].append(mat)

    for lesson in lessons_list:
        if lesson["module_id"] in modules_map:
            modules_map[lesson["module_id"]]["lessons"].append(lesson)

    course["modules"] = modules_list
    return course


async def create_module(db: AsyncSession, course_id: str, title: str) -> dict:
    """Create a new course module."""
    # Get max order_index
    result = await db.execute(
        text("SELECT COALESCE(MAX(order_index), 0) FROM general_course_modules WHERE course_id = :cid"),
        {"cid": course_id},
    )
    next_order = result.scalar() + 1

    result = await db.execute(
        text("""
            INSERT INTO general_course_modules (course_id, title, order_index)
            VALUES (:cid, :title, :ord)
            RETURNING module_id::text
        """),
        {"cid": course_id, "title": title, "ord": next_order},
    )
    module_id = result.scalar()
    await db.commit()

    return {
        "module_id": module_id,
        "course_id": course_id,
        "title": title,
        "order_index": next_order,
        "lessons": [],
    }


async def create_lesson(db: AsyncSession, module_id: str, title: str, video_url: str = "") -> dict:
    """Create a new lesson in a module."""
    result = await db.execute(
        text("SELECT COALESCE(MAX(order_index), 0) FROM general_course_lessons WHERE module_id = :mid"),
        {"mid": module_id},
    )
    next_order = result.scalar() + 1

    result = await db.execute(
        text("""
            INSERT INTO general_course_lessons (module_id, title, video_url, order_index)
            VALUES (:mid, :title, :vurl, :ord)
            RETURNING lesson_id::text
        """),
        {"mid": module_id, "title": title, "vurl": video_url, "ord": next_order},
    )
    lesson_id = result.scalar()
    await db.commit()

    return {
        "lesson_id": lesson_id,
        "module_id": module_id,
        "title": title,
        "video_url": video_url,
        "order_index": next_order,
        "materials": [],
    }


async def update_lesson_order(db: AsyncSession, module_id: str, lesson_ids: list[str]) -> None:
    """Reorder lessons in a module using a safe offset strategy."""
    # Shift all to +10000 first (avoid UNIQUE conflict)
    await db.execute(
        text("UPDATE general_course_lessons SET order_index = order_index + 10000 WHERE module_id = :mid"),
        {"mid": module_id},
    )
    # Assign target indices
    for idx, lesson_id in enumerate(lesson_ids):
        await db.execute(
            text("UPDATE general_course_lessons SET order_index = :ord WHERE lesson_id = :lid AND module_id = :mid"),
            {"ord": idx + 1, "lid": lesson_id, "mid": module_id},
        )
    await db.commit()


async def toggle_course_visibility(db: AsyncSession, course_id: str, status: str) -> None:
    """Update course visibility status."""
    await db.execute(
        text("UPDATE general_courses SET visibility_status = :st WHERE course_id = :cid AND is_deleted = FALSE"),
        {"st": status, "cid": course_id},
    )
    await db.commit()
