"""
Seed data script for E-Learning Database.
Usage:
    python -m app.db.seed          # Full seed
    python -m app.db.seed --reset  # Delete existing then seed
    python -m app.db.seed --minimal # Only roles + users (for testing)
"""
import argparse
import asyncio

import asyncpg

from app.core.config import settings
from app.core.security import hash_password


DELETE_ORDER = [
    "user_feedbacks",
    "course_enrollments",
    "transaction_logs",
    "learning_materials",
    "general_course_lessons",
    "general_course_modules",
    "general_courses",
    "dictionary_variations",
    "dictionary_entries",
    "dictionary_categories",
    "microlearning_questions",
    "microlearning_lesson_parts",
    "microlearning_lessons",
    "microlearning_units",
    "microlearning_topics",
]


async def seed(conn: asyncpg.Connection, minimal: bool = False):
    # --- Clean up (idempotent) ---
    for table in DELETE_ORDER:
        await conn.execute(f"DELETE FROM {table}")

    # --- 1. Roles ---
    await conn.execute(
        "INSERT INTO roles (role_name) VALUES ('ADMIN') ON CONFLICT (role_name) DO NOTHING"
    )
    await conn.execute(
        "INSERT INTO roles (role_name) VALUES ('TEACHER') ON CONFLICT (role_name) DO NOTHING"
    )
    await conn.execute(
        "INSERT INTO roles (role_name) VALUES ('STUDENT') ON CONFLICT (role_name) DO NOTHING"
    )

    student_role = await conn.fetchval("SELECT role_id FROM roles WHERE role_name = 'STUDENT'")
    teacher_role = await conn.fetchval("SELECT role_id FROM roles WHERE role_name = 'TEACHER'")
    admin_role = await conn.fetchval("SELECT role_id FROM roles WHERE role_name = 'ADMIN'")

    # --- 2. Users ---
    student_id = await conn.fetchval(
        """INSERT INTO users (username, password_hash, email, role_id, status)
           VALUES ('student1', 'fake_hash', 'student1@elearning.com', $1, 'active')
           ON CONFLICT (username) DO UPDATE SET user_id = users.user_id
           RETURNING user_id""",
        student_role,
    )

    teacher_id = await conn.fetchval(
        """INSERT INTO users (username, password_hash, email, role_id, status)
           VALUES ('teacher1', 'fake_hash', 'teacher1@elearning.com', $1, 'active')
           ON CONFLICT (username) DO UPDATE SET user_id = users.user_id
           RETURNING user_id""",
        teacher_role,
    )

    admin_id = await conn.fetchval(
        """INSERT INTO users (username, password_hash, email, role_id, status)
           VALUES ('admin', $1, 'admin@elearning.com', $2, 'active')
           ON CONFLICT (username) DO UPDATE SET user_id = users.user_id
           RETURNING user_id""",
        hash_password("admin123"),
        admin_role,
    )

    # --- 3. Profiles ---
    await conn.execute(
        """INSERT INTO user_profiles (user_id, full_name, date_of_birth, phone_number)
           VALUES ($1, 'Nguyen Van A', '2000-01-01', '0123456789')
           ON CONFLICT (user_id) DO NOTHING""",
        student_id,
    )
    await conn.execute(
        """INSERT INTO user_profiles (user_id, full_name, date_of_birth, phone_number)
           VALUES ($1, 'Tran Thi B', '1985-05-12', '0987654321')
           ON CONFLICT (user_id) DO NOTHING""",
        teacher_id,
    )
    await conn.execute(
        """INSERT INTO user_profiles (user_id, full_name, date_of_birth, phone_number)
           VALUES ($1, 'System Admin', '1990-01-01', '0999999999')
           ON CONFLICT (user_id) DO NOTHING""",
        admin_id,
    )

    # --- 4. Student & Teacher child records ---
    await conn.execute(
        """INSERT INTO students (user_id, grade_level, school_name)
           VALUES ($1, '12', 'PTIT') ON CONFLICT (user_id) DO NOTHING""",
        student_id,
    )
    await conn.execute(
        """INSERT INTO teachers (user_id, bio, department)
           VALUES ($1, 'Expert in Sign Language', 'IT') ON CONFLICT (user_id) DO NOTHING""",
        teacher_id,
    )

    # --- 5. Wallets ---
    await conn.execute(
        "INSERT INTO wallets (user_id, balance) VALUES ($1, 1000000.00) ON CONFLICT (user_id) DO NOTHING",
        student_id,
    )
    await conn.execute(
        "INSERT INTO wallets (user_id, balance) VALUES ($1, 500000.00) ON CONFLICT (user_id) DO NOTHING",
        teacher_id,
    )

    if minimal:
        print("Seed (minimal) loaded successfully!")
        return

    # --- 6. Course Category ---
    category_id = await conn.fetchval(
        """INSERT INTO general_course_categories (name)
           VALUES ('Ngon ngu ky hieu')
           ON CONFLICT (name) DO NOTHING
           RETURNING category_id"""
    )
    if category_id is None:
        category_id = await conn.fetchval(
            "SELECT category_id FROM general_course_categories WHERE name = 'Ngon ngu ky hieu'"
        )

    # --- 7. Courses ---
    course1_id = await conn.fetchval(
        """INSERT INTO general_courses (title, price, teacher_id, category_id, visibility_status)
           VALUES ('Khoa hoc Ky nang Giao tiep ngon ngu ky hieu', 500000.00, $1, $2, 'DRAFT')
           RETURNING course_id""",
        teacher_id, category_id,
    )
    course2_id = await conn.fetchval(
        """INSERT INTO general_courses (title, price, teacher_id, category_id, visibility_status)
           VALUES ('Tu vung Ngon ngu ky hieu co ban', 250000.00, $1, $2, 'PUBLISHED')
           RETURNING course_id""",
        teacher_id, category_id,
    )

    # --- 8. Modules ---
    module1_id = await conn.fetchval(
        """INSERT INTO general_course_modules (course_id, title, order_index)
           VALUES ($1, 'Chương 1: Giới thiệu về ngôn ngữ ký hiệu', 1)
           RETURNING module_id""",
        course1_id,
    )
    module2_id = await conn.fetchval(
        """INSERT INTO general_course_modules (course_id, title, order_index)
           VALUES ($1, 'Chương 2: Các ký hiệu chữ cái và số cơ bản', 2)
           RETURNING module_id""",
        course1_id,
    )

    # --- 9. Lessons ---
    lesson1_id = await conn.fetchval(
        """INSERT INTO general_course_lessons (module_id, title, video_url, order_index)
           VALUES ($1, 'Bài 1: Lịch sử hình thành ngôn ngữ ký hiệu', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 1)
           RETURNING lesson_id""",
        module1_id,
    )
    await conn.execute(
        """INSERT INTO general_course_lessons (module_id, title, video_url, order_index)
           VALUES ($1, 'Bài 2: Các quy tắc giao tiếp cơ bản', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 2)""",
        module1_id,
    )
    await conn.execute(
        """INSERT INTO general_course_lessons (module_id, title, video_url, order_index)
           VALUES ($1, 'Bài 3: Cách chào hỏi bằng ngôn ngữ ký hiệu', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 3)""",
        module1_id,
    )
    await conn.execute(
        """INSERT INTO general_course_lessons (module_id, title, video_url, order_index)
           VALUES ($1, 'Bài 4: Ký hiệu các chữ cái từ A đến Z', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 1)""",
        module2_id,
    )

    # --- 10. Learning Materials ---
    await conn.execute(
        """INSERT INTO learning_materials (lesson_id, title, content_url, material_transcript)
           VALUES ($1, 'Tài liệu Lịch sử ngôn ngữ ký hiệu', 'https://example.com/tailieu1.pdf',
                   '{"transcript": "Bản dịch tài liệu lịch sử..."}'::jsonb)""",
        lesson1_id,
    )

    # --- 11. Transactions ---
    await conn.execute(
        """INSERT INTO transaction_logs (from_wallet_user_id, to_wallet_user_id, amount, status, message, related_course_id)
           VALUES ($1, $2, 500000.00, 'SUCCESS', 'Mua khóa học: Khoa hoc Ky nang Giao tiep ngon ngu ky hieu', $3)""",
        student_id, teacher_id, course1_id,
    )
    await conn.execute(
        """INSERT INTO transaction_logs (from_wallet_user_id, to_wallet_user_id, amount, status, message, related_course_id)
           VALUES ($1, $2, 250000.00, 'SUCCESS', 'Mua khóa học: Tu vung Ngon ngu ky hieu co ban', $3)""",
        student_id, teacher_id, course2_id,
    )
    await conn.execute(
        """INSERT INTO transaction_logs (from_wallet_user_id, to_wallet_user_id, amount, status, message, related_course_id)
           VALUES ($1, $2, 500000.00, 'FAILED', 'Mua khóa học: Giao dịch thất bại do số dư không đủ', $3)""",
        student_id, teacher_id, course1_id,
    )

    # --- 12. Enrollments ---
    await conn.execute(
        """INSERT INTO course_enrollments (student_id, course_id, progress)
           VALUES ($1, $2, 65.0) ON CONFLICT (student_id, course_id) DO NOTHING""",
        student_id, course1_id,
    )
    await conn.execute(
        """INSERT INTO course_enrollments (student_id, course_id, progress)
           VALUES ($1, $2, 80.0) ON CONFLICT (student_id, course_id) DO NOTHING""",
        student_id, course2_id,
    )

    # --- 13. Feedbacks ---
    await conn.execute(
        """INSERT INTO user_feedbacks (user_id, rating, feedback_text, context)
           VALUES ($1, 5, 'Khóa học giao tiếp tuyệt vời', 'Khoa hoc Ky nang Giao tiep ngon ngu ky hieu')""",
        student_id,
    )
    await conn.execute(
        """INSERT INTO user_feedbacks (user_id, rating, feedback_text, context)
           VALUES ($1, 5, 'Rất dễ hiểu', 'Khoa hoc Ky nang Giao tiep ngon ngu ky hieu')""",
        student_id,
    )
    await conn.execute(
        """INSERT INTO user_feedbacks (user_id, rating, feedback_text, context)
           VALUES ($1, 1, 'Video hơi mờ', 'Khoa hoc Ky nang Giao tiep ngon ngu ky hieu')""",
        student_id,
    )
    await conn.execute(
        """INSERT INTO user_feedbacks (user_id, rating, feedback_text, context)
           VALUES ($1, 5, 'Nội dung rất bổ ích', 'Tu vung Ngon ngu ky hieu co ban')""",
        student_id,
    )
    await conn.execute(
        """INSERT INTO user_feedbacks (user_id, rating, feedback_text, context)
           VALUES ($1, 4, 'Tương đối đầy đủ', 'Tu vung Ngon ngu ky hieu co ban')""",
        student_id,
    )

    # --- 14. Dictionary categories ---
    cat_basic = await conn.fetchval(
        "INSERT INTO dictionary_categories (name, description) VALUES ('Từ vựng cơ bản', 'Các từ vựng tiếng Khmer thông dụng hàng ngày') RETURNING category_id"
    )
    cat_places = await conn.fetchval(
        "INSERT INTO dictionary_categories (name, description) VALUES ('Địa danh', 'Các địa danh lịch sử và du lịch nổi tiếng tại Campuchia') RETURNING category_id"
    )
    cat_food = await conn.fetchval(
        "INSERT INTO dictionary_categories (name, description) VALUES ('Ẩm thực', 'Các món ăn và thuật ngữ ẩm thực truyền thống Khmer') RETURNING category_id"
    )

    # --- 15. Dictionary entries & variations ---
    angkor_id = await conn.fetchval(
        """INSERT INTO dictionary_entries (category_id, word, meaning)
           VALUES ($1, 'AngkorWat', 'Ăng-kor Vát - Quần thể đền đài tại Campuchia...')
           RETURNING entry_id""",
        cat_places,
    )
    await conn.execute(
        "INSERT INTO dictionary_variations (entry_id, region, video_url, description) VALUES ($1, 'Siem Reap', $2, $3)",
        angkor_id, 'https://www.youtube.com/watch?v=1234567890a', 'Phát âm chuẩn giọng bản địa vùng Siem Reap'
    )
    await conn.execute(
        "INSERT INTO dictionary_variations (entry_id, region, video_url, description) VALUES ($1, 'Phnom Penh', $2, $3)",
        angkor_id, 'https://www.youtube.com/watch?v=1234567890b', 'Phát âm theo giọng thủ đô'
    )

    khmer_id = await conn.fetchval(
        "INSERT INTO dictionary_entries (category_id, word, meaning) VALUES ($1, 'Khmer', 'Người Khmer hoặc Tiếng Khmer') RETURNING entry_id",
        cat_basic,
    )
    await conn.execute(
        "INSERT INTO dictionary_variations (entry_id, region, video_url, description) VALUES ($1, 'Phnom Penh', $2, $3)",
        khmer_id, 'https://www.youtube.com/watch?v=abcdefghij1', 'Phát âm từ Khmer giọng Phnom Penh'
    )
    await conn.execute(
        "INSERT INTO dictionary_variations (entry_id, region, video_url, description) VALUES ($1, 'Battambang', $2, $3)",
        khmer_id, 'https://www.youtube.com/watch?v=abcdefghij2', 'Phát âm từ Khmer giọng Battambang'
    )

    phnom_id = await conn.fetchval(
        "INSERT INTO dictionary_entries (category_id, word, meaning) VALUES ($1, 'Phnom', 'Thủ đô Campuchia') RETURNING entry_id",
        cat_places,
    )
    await conn.execute(
        "INSERT INTO dictionary_variations (entry_id, region, video_url, description) VALUES ($1, 'Phnom Penh', $2, $3)",
        phnom_id, 'https://www.youtube.com/watch?v=xyz98765432', 'Giọng địa phương thủ đô'
    )

    amok_id = await conn.fetchval(
        "INSERT INTO dictionary_entries (category_id, word, meaning) VALUES ($1, 'Amok', 'Món cá hấp Amok') RETURNING entry_id",
        cat_food,
    )
    await conn.execute(
        "INSERT INTO dictionary_variations (entry_id, region, video_url, description) VALUES ($1, 'Siem Reap', $2, $3)",
        amok_id, 'https://www.youtube.com/watch?v=amok1234567', 'Phát âm chuẩn địa phương Siem Reap'
    )

    # --- 16. Microlearning topics ---
    topic1_id = await conn.fetchval(
        "INSERT INTO microlearning_topics (title, description) VALUES ('Bảng chữ cái & Âm tiết', 'Học các nguyên âm...') RETURNING topic_id"
    )
    topic2_id = await conn.fetchval(
        "INSERT INTO microlearning_topics (title, description) VALUES ('Giao tiếp cơ bản', 'Các chủ đề hội thoại...') RETURNING topic_id"
    )

    unit1_id = await conn.fetchval(
        "INSERT INTO microlearning_units (topic_id, title, order_index) VALUES ($1, 'Phụ âm nhóm 1 (O-Group)', 1) RETURNING unit_id",
        topic1_id,
    )
    await conn.execute(
        "INSERT INTO microlearning_units (topic_id, title, order_index) VALUES ($1, 'Phụ âm nhóm 2 (A-Group)', 2)",
        topic1_id,
    )
    await conn.execute(
        "INSERT INTO microlearning_units (topic_id, title, order_index) VALUES ($1, 'Chào hỏi & Xưng hô', 1)",
        topic2_id,
    )

    ml_lesson1_id = await conn.fetchval(
        "INSERT INTO microlearning_lessons (unit_id, title, video_url, order_index) VALUES ($1, 'Bài 1: Phụ âm Kô và Khô', $2, 1) RETURNING lesson_id",
        unit1_id, 'https://www.youtube.com/watch?v=khmer_lesson1',
    )
    quiz_part_id = await conn.fetchval(
        "INSERT INTO microlearning_lesson_parts (lesson_id, title, part_type, content, order_index) VALUES ($1, 'Bài tập trắc nghiệm nhanh', 'quiz', 'Hãy hoàn thành...', 2) RETURNING part_id",
        ml_lesson1_id,
    )

    await conn.execute(
        "INSERT INTO microlearning_questions (part_id, question_text, question_type, options_json, correct_answer) VALUES ($1, 'Phụ âm nào sau đây...', 'single_choice', $2::jsonb, 'Cả hai')",
        quiz_part_id, '["Kô", "Khô", "Cả hai"]'
    )

    # --- 17. Notifications ---
    await conn.execute(
        """INSERT INTO notification_users (user_id, title, message, is_read, created_at) VALUES
           ($1, 'Hệ thống bảo trì', 'Hệ thống E-Learning sẽ bảo trì...', FALSE, '2026-06-15 10:00:00+07')""",
        student_id,
    )
    await conn.execute(
        """INSERT INTO notification_users (user_id, title, message, is_read, created_at) VALUES
           ($1, 'Bài nộp mới', 'Học viên student1 đã nộp bài...', FALSE, '2026-06-16 14:00:00+07')""",
        teacher_id,
    )

    # --- 18. Audit logs ---
    await conn.execute(
        """INSERT INTO audit_logs (run_id, action, status, created_at) VALUES
           (gen_random_uuid(), 'BUY_COURSE', 'SUCCESS', '2026-06-16 15:10:00+07')"""
    )
    await conn.execute(
        """INSERT INTO audit_logs (run_id, action, status, created_at) VALUES
           (gen_random_uuid(), 'TOPUP_WALLET', 'SUCCESS', '2026-06-16 15:15:00+07')"""
    )

    print("Seed data loaded successfully!")


async def main():
    parser = argparse.ArgumentParser(description="Seed E-Learning database")
    parser.add_argument("--reset", action="store_true", help="Drop all data first")
    parser.add_argument("--minimal", action="store_true", help="Only seed roles and users")
    args = parser.parse_args()

    conn = await asyncpg.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database=settings.DB_NAME,
    )

    try:
        if args.reset:
            # Cascade truncate roles and other identity tables to reset all tables and sequences
            await conn.execute("TRUNCATE TABLE roles, general_course_categories, dictionary_categories, microlearning_topics, achievements RESTART IDENTITY CASCADE")
            await conn.execute("DELETE FROM audit_logs")
            print("All data reset.")

        await seed(conn, minimal=args.minimal)
    except Exception as e:
        print(f"Seeding error: {e}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
