import json

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


# ── Phase 2: Course CRUD ──

async def create_course(db: AsyncSession, req) -> dict:
    """Tạo khóa học mới. Validate teacher tồn tại và có role TEACHER."""
    # Validate teacher
    result = await db.execute(
        text("""
            SELECT 1 FROM teachers t
            JOIN users u ON t.user_id = u.user_id
            WHERE t.user_id = :tid AND u.status = 'active'
        """),
        {"tid": req.teacher_id},
    )
    if not result.scalar():
        raise ValueError("Giáo viên không tồn tại hoặc đã bị khóa")

    # Validate category
    result = await db.execute(
        text("SELECT 1 FROM general_course_categories WHERE category_id = :cid"),
        {"cid": req.category_id},
    )
    if not result.scalar():
        raise ValueError("Danh mục khóa học không tồn tại")

    result = await db.execute(
        text("""
            INSERT INTO general_courses
                (teacher_id, category_id, title, description, image_url, price, visibility_status)
            VALUES (:tid, :cid, :title, :desc, :img, :price, 'DRAFT')
            RETURNING course_id::text
        """),
        {
            "tid": req.teacher_id,
            "cid": req.category_id,
            "title": req.title,
            "desc": req.description or "",
            "img": req.image_url or "",
            "price": req.price,
        },
    )
    course_id = result.scalar()
    await db.commit()

    return {
        "course_id": course_id,
        "teacher_id": req.teacher_id,
        "category_id": req.category_id,
        "title": req.title,
        "visibility_status": "DRAFT",
        "price": req.price,
    }


async def update_course(db: AsyncSession, course_id: str, req) -> dict:
    """Cập nhật thông tin khóa học. Chỉ update các field được cung cấp."""
    updates = []
    params = {"cid": course_id}

    if req.title is not None:
        updates.append("title = :title")
        params["title"] = req.title
    if req.description is not None:
        updates.append("description = :desc")
        params["desc"] = req.description
    if req.image_url is not None:
        updates.append("image_url = :img")
        params["img"] = req.image_url
    if req.price is not None:
        updates.append("price = :price")
        params["price"] = req.price
    if req.category_id is not None:
        updates.append("category_id = :cat")
        params["cat"] = req.category_id

    if updates:
        await db.execute(
            text(f"UPDATE general_courses SET {', '.join(updates)} WHERE course_id = :cid AND is_deleted = FALSE"),
            params,
        )
        await db.commit()

    # Trả về course đã update
    result = await db.execute(
        text("SELECT course_id::text, title, description, image_url, price, visibility_status FROM general_courses WHERE course_id = :cid"),
        {"cid": course_id},
    )
    return dict(result.mappings().first())


async def delete_course(db: AsyncSession, course_id: str) -> None:
    """Soft-delete khóa học."""
    await db.execute(
        text("UPDATE general_courses SET is_deleted = TRUE WHERE course_id = :cid"),
        {"cid": course_id},
    )
    await db.commit()


# ── Phase 2: Module / Lesson / Material CRUD ──

async def update_module(db: AsyncSession, module_id: str, title: str) -> dict:
    """Cập nhật tên module."""
    await db.execute(
        text("UPDATE general_course_modules SET title = :t WHERE module_id = :mid"),
        {"t": title, "mid": module_id},
    )
    await db.commit()
    result = await db.execute(
        text("SELECT module_id::text, course_id::text, title, order_index FROM general_course_modules WHERE module_id = :mid"),
        {"mid": module_id},
    )
    return dict(result.mappings().first())


async def delete_module(db: AsyncSession, module_id: str) -> None:
    """Xóa module (CASCADE xuống lessons + materials). Sau đó reorder."""
    result = await db.execute(
        text("SELECT course_id FROM general_course_modules WHERE module_id = :mid"),
        {"mid": module_id},
    )
    row = result.mappings().first()
    if not row:
        raise ValueError("module not found")
    course_id = row["course_id"]

    await db.execute(
        text("DELETE FROM general_course_modules WHERE module_id = :mid"),
        {"mid": module_id},
    )
    await db.commit()

    # Reorder các module còn lại
    await _reorder_modules(db, str(course_id))


async def update_lesson(db: AsyncSession, lesson_id: str, req) -> dict:
    """Cập nhật bài học (title, video_url)."""
    updates = []
    params = {"lid": lesson_id}
    if req.title is not None:
        updates.append("title = :title")
        params["title"] = req.title
    if req.video_url is not None:
        updates.append("video_url = :vurl")
        params["vurl"] = req.video_url

    if updates:
        await db.execute(
            text(f"UPDATE general_course_lessons SET {', '.join(updates)} WHERE lesson_id = :lid"),
            params,
        )
        await db.commit()

    result = await db.execute(
        text("SELECT lesson_id::text, module_id::text, title, video_url, order_index FROM general_course_lessons WHERE lesson_id = :lid"),
        {"lid": lesson_id},
    )
    return dict(result.mappings().first())


async def delete_lesson(db: AsyncSession, lesson_id: str) -> None:
    """Xóa bài học (CASCADE xuống materials). Sau đó reorder."""
    result = await db.execute(
        text("SELECT module_id FROM general_course_lessons WHERE lesson_id = :lid"),
        {"lid": lesson_id},
    )
    row = result.mappings().first()
    if not row:
        raise ValueError("lesson not found")
    module_id = row["module_id"]

    await db.execute(
        text("DELETE FROM general_course_lessons WHERE lesson_id = :lid"),
        {"lid": lesson_id},
    )
    await db.commit()

    await _reorder_lessons(db, str(module_id))


async def create_material(db: AsyncSession, req) -> dict:
    """Thêm learning material vào bài học."""
    result = await db.execute(
        text("""
            INSERT INTO learning_materials (lesson_id, title, content_url, material_transcript)
            VALUES (:lid, :title, :url, :transcript::jsonb)
            RETURNING material_id::text
        """),
        {
            "lid": req.lesson_id,
            "title": req.title,
            "url": req.content_url,
            "transcript": json.dumps(req.material_transcript) if req.material_transcript else None,
        },
    )
    material_id = result.scalar()
    await db.commit()
    return {
        "material_id": material_id,
        "lesson_id": req.lesson_id,
        "title": req.title,
        "content_url": req.content_url,
    }


async def update_material(db: AsyncSession, material_id: str, req) -> dict:
    """Cập nhật material."""
    updates = []
    params = {"mid": material_id}
    if req.title is not None:
        updates.append("title = :title")
        params["title"] = req.title
    if req.content_url is not None:
        updates.append("content_url = :url")
        params["url"] = req.content_url
    if req.material_transcript is not None:
        updates.append("material_transcript = :transcript::jsonb")
        params["transcript"] = json.dumps(req.material_transcript)

    if updates:
        await db.execute(
            text(f"UPDATE learning_materials SET {', '.join(updates)} WHERE material_id = :mid"),
            params,
        )
        await db.commit()

    result = await db.execute(
        text("SELECT material_id::text, lesson_id::text, title, content_url, material_transcript FROM learning_materials WHERE material_id = :mid"),
        {"mid": material_id},
    )
    return dict(result.mappings().first())


async def delete_material(db: AsyncSession, material_id: str) -> None:
    """Xóa material."""
    await db.execute(
        text("DELETE FROM learning_materials WHERE material_id = :mid"),
        {"mid": material_id},
    )
    await db.commit()


# ── Phase 2: Reorder helpers ──

async def _reorder_modules(db: AsyncSession, course_id: str) -> None:
    """Đánh lại order_index cho các module sau khi xóa."""
    modules_result = await db.execute(
        text("SELECT module_id FROM general_course_modules WHERE course_id = :cid ORDER BY order_index ASC"),
        {"cid": course_id},
    )
    for idx, row in enumerate(modules_result.mappings(), start=1):
        await db.execute(
            text("UPDATE general_course_modules SET order_index = :ord WHERE module_id = :mid"),
            {"ord": idx, "mid": row["module_id"]},
        )
    await db.commit()


async def _reorder_lessons(db: AsyncSession, module_id: str) -> None:
    """Đánh lại order_index cho các lessons sau khi xóa."""
    lessons_result = await db.execute(
        text("SELECT lesson_id FROM general_course_lessons WHERE module_id = :mid ORDER BY order_index ASC"),
        {"mid": module_id},
    )
    for idx, row in enumerate(lessons_result.mappings(), start=1):
        await db.execute(
            text("UPDATE general_course_lessons SET order_index = :ord WHERE lesson_id = :lid"),
            {"ord": idx, "lid": row["lesson_id"]},
        )
    await db.commit()


# ── Phase 2: Public course detail & categories ──

async def get_course_detail(db: AsyncSession, course_id: str) -> dict:
    """Public: chi tiết khóa học + thống kê."""
    result = await db.execute(
        text("""
            SELECT
                c.course_id::text,
                c.teacher_id::text,
                COALESCE(up.full_name, 'Giảng viên') AS teacher_name,
                c.category_id,
                COALESCE(gcc.name, '') AS category_name,
                c.title,
                COALESCE(c.description, '') AS description,
                COALESCE(c.image_url, '') AS image_url,
                c.price,
                c.visibility_status,
                c.updated_at,
                (SELECT COUNT(*) FROM general_course_modules WHERE course_id = c.course_id) AS total_modules,
                (SELECT COUNT(*) FROM general_course_lessons l
                 JOIN general_course_modules m ON l.module_id = m.module_id
                 WHERE m.course_id = c.course_id) AS total_lessons,
                (SELECT COUNT(*) FROM course_enrollments WHERE course_id = c.course_id) AS total_enrollments
            FROM general_courses c
            LEFT JOIN user_profiles up ON c.teacher_id = up.user_id
            LEFT JOIN general_course_categories gcc ON c.category_id = gcc.category_id
            WHERE c.course_id = :cid AND c.is_deleted = FALSE
        """),
        {"cid": course_id},
    )
    row = result.mappings().first()
    if row is None:
        raise ValueError("course not found")
    return dict(row)


async def get_course_categories(db: AsyncSession) -> list[dict]:
    """Liệt kê danh mục khóa học."""
    result = await db.execute(
        text("SELECT category_id, name FROM general_course_categories ORDER BY name ASC")
    )
    return [dict(row) for row in result.mappings()]


# ── Phase 2: Progress (sp_update_course_progress) ──

async def update_course_progress(db: AsyncSession, req) -> dict:
    """Cập nhật tiến độ học — gọi stored procedure."""
    try:
        await db.execute(
            text("CALL sp_update_course_progress(:sid, :cid, :prog)"),
            {"sid": req.student_id, "cid": req.course_id, "prog": req.progress},
        )
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise ValueError(str(e))

    # Lấy progress hiện tại
    result = await db.execute(
        text("SELECT progress FROM course_enrollments WHERE student_id = :sid AND course_id = :cid"),
        {"sid": req.student_id, "cid": req.course_id},
    )
    current = result.scalar()

    return {
        "student_id": req.student_id,
        "course_id": req.course_id,
        "progress": float(current) if current else 0.0,
        "message": "Cập nhật tiến độ thành công",
    }
