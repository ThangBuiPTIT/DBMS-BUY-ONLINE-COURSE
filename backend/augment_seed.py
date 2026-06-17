"""
Augment seed data — fill empty tables and add more sample data for UI richness.
Idempotent: only inserts missing rows.
"""
import asyncio
from datetime import date
import asyncpg

DB = dict(host='localhost', port=5432, user='postgres', password='Chiendp1ln@', database='postgres')


async def main():
    conn = await asyncpg.connect(**DB)
    try:
        # ----- Students/teachers for richer UI -----
        student_role = await conn.fetchval("SELECT role_id FROM roles WHERE role_name='STUDENT'")
        teacher_role = await conn.fetchval("SELECT role_id FROM roles WHERE role_name='TEACHER'")

        students_to_add = [
            ('student2', 'Pham Thi C',  date(2001, 3, 15), '0912345678', '11', 'HUST'),
            ('student3', 'Le Van D',     date(2000, 8, 22), '0923456789', '12', 'NEU'),
            ('student4', 'Hoang Thi E',  date(2002, 11, 5), '0934567890', '10', 'HCMUS'),
            ('student5', 'Vu Van F',     date(1999, 6, 18), '0945678901', '12', 'PTIT'),
        ]  # fmt: off
        for username, full_name, dob, phone, grade, school in students_to_add:
            uid = await conn.fetchval(
                """INSERT INTO users (username, password_hash, email, role_id, status)
                   VALUES ($1, 'fake_hash', $2, $3, 'active')
                   ON CONFLICT (username) DO UPDATE SET email = EXCLUDED.email
                   RETURNING user_id""",
                username, f'{username}@elearning.com', student_role,
            )
            await conn.execute(
                """INSERT INTO user_profiles (user_id, full_name, date_of_birth, phone_number)
                   VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO NOTHING""",
                uid, full_name, dob, phone,
            )
            await conn.execute(
                """INSERT INTO students (user_id, grade_level, school_name)
                   VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING""",
                uid, grade, school,
            )
            await conn.execute(
                """INSERT INTO wallets (user_id, balance)
                   VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING""",
                uid, 750000.00,
            )

        teachers_to_add = [
            ('teacher2', 'Nguyen Thi G', date(1980, 4, 12), '0956789012', 'Chuyên gia Ngôn ngữ Ký hiệu, 15 năm kinh nghiệm', 'Linguistics'),
            ('teacher3', 'Tran Van H',   date(1978, 9, 25), '0967890123', 'Giảng viên Đại học, nghiên cứu viên về giao tiếp', 'Education'),
        ]  # fmt: off
        for username, full_name, dob, phone, bio, dept in teachers_to_add:
            uid = await conn.fetchval(
                """INSERT INTO users (username, password_hash, email, role_id, status)
                   VALUES ($1, 'fake_hash', $2, $3, 'active')
                   ON CONFLICT (username) DO UPDATE SET email = EXCLUDED.email
                   RETURNING user_id""",
                username, f'{username}@elearning.com', teacher_role,
            )
            await conn.execute(
                """INSERT INTO user_profiles (user_id, full_name, date_of_birth, phone_number)
                   VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO NOTHING""",
                uid, full_name, dob, phone,
            )
            await conn.execute(
                """INSERT INTO teachers (user_id, bio, department)
                   VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING""",
                uid, bio, dept,
            )

        # ----- Achievements -----
        achievements = [
            ('first_login',     'Lần đầu đăng nhập',           'Chào mừng bạn đến với E-Learning!',                '🌟'),
            ('first_course',    'Khóa học đầu tiên',           'Hoàn thành việc mua khóa học đầu tiên',           '🎓'),
            ('streak_3',        'Streak 3 ngày',                'Học liên tục 3 ngày liên tiếp',                   '🔥'),
            ('streak_7',        'Streak 7 ngày',                'Học liên tục 7 ngày liên tiếp',                   '🔥'),
            ('streak_30',       'Streak 30 ngày',               'Học liên tục 30 ngày liên tiếp',                  '💎'),
            ('quiz_master',     'Bậc thầy Quiz',                'Đạt điểm tuyệt đối 10 bài quiz microlearning',     '🧠'),
            ('top_10',          'Top 10 bảng xếp hạng',         'Lọt vào Top 10 học viên xuất sắc',                '🏆'),
            ('course_complete', 'Hoàn thành khóa học',          'Hoàn thành 100% một khóa học bất kỳ',             '✅'),
        ]  # fmt: off
        ach_ids = {}
        for code, name, desc, icon in achievements:
            aid = await conn.fetchval(
                """INSERT INTO achievements (title, description, icon_url)
                   VALUES ($1, $2, $3) RETURNING achievement_id""",
                name, desc, icon,
            )
            ach_ids[code] = aid

        # ----- Student streaks (1 per student) -----
        all_students = await conn.fetch("SELECT user_id FROM students")
        for s in all_students:
            uid = s['user_id']
            exists = await conn.fetchval("SELECT 1 FROM student_streaks WHERE student_id=$1", uid)
            if not exists:
                # Random streak values for visual variety
                current = 7
                longest = 14
                last_active = '2026-06-17'
                await conn.execute(
                    """INSERT INTO student_streaks
                       (student_id, current_streak, highest_streak, last_activity_date)
                       VALUES ($1,$2,$3,$4)""",
                    uid, 7, 14, date(2026, 6, 17),
                )

        # ----- User achievements (each student earns some) -----
        # First-login for everyone
        for s in all_students:
            uid = s['user_id']
            for code in ['first_login', 'first_course']:
                if ach_ids.get(code):
                    exists = await conn.fetchval(
                        "SELECT 1 FROM user_achievements WHERE user_id=$1 AND achievement_id=$2",
                        uid, ach_ids[code],
                    )
                    if not exists:
                        await conn.execute(
                            """INSERT INTO user_achievements (user_id, achievement_id, earned_at)
                               VALUES ($1, $2, CURRENT_TIMESTAMP - (random() * interval '30 days'))""",
                            uid, ach_ids[code],
                        )
            # Some students also have streak achievements
            if ach_ids.get('streak_3'):
                exists = await conn.fetchval(
                    "SELECT 1 FROM user_achievements WHERE user_id=$1 AND achievement_id=$2",
                    uid, ach_ids['streak_3'],
                )
                if not exists:
                    await conn.execute(
                        """INSERT INTO user_achievements (user_id, achievement_id, earned_at)
                           VALUES ($1, $2, CURRENT_TIMESTAMP - (random() * interval '15 days'))""",
                        uid, ach_ids['streak_3'],
                    )
            # Top student also has streak_7 + top_10
            if str(uid) == str(all_students[0]['user_id']):
                if ach_ids.get('streak_7'):
                    await conn.execute(
                        """INSERT INTO user_achievements (user_id, achievement_id, earned_at)
                           VALUES ($1, $2, CURRENT_TIMESTAMP - interval '5 days')
                           ON CONFLICT DO NOTHING""",
                        uid, ach_ids['streak_7'],
                    )

        # ----- Comments on lessons -----
        # Take any published course's lessons, add comments from various students
        lessons = await conn.fetch(
            """SELECT l.lesson_id, l.title FROM general_course_lessons l
               JOIN general_course_modules m ON l.module_id = m.module_id
               JOIN general_courses c ON m.course_id = c.course_id
               WHERE c.visibility_status='PUBLISHED'
               LIMIT 3"""
        )
        if lessons:
            comments_data = [
                ('Bài học rất dễ hiểu, cảm ơn thầy/cô!',     5),
                ('Video hơi nhanh, mong có phần giải thích chậm hơn', 4),
                ('Tôi đã học được rất nhiều điều bổ ích',     5),
                ('Phần thực hành cần thêm ví dụ cụ thể hơn', 4),
                ('Hoàn hảo cho người mới bắt đầu',            5),
                ('Bài tập cuối hơi khó, cần thêm gợi ý',     4),
            ]
            for i, lesson in enumerate(lessons):
                # Each lesson gets comments from 2-3 different students
                n_comments = 2 + (i % 2)
                for j in range(n_comments):
                    s = all_students[(i + j) % len(all_students)]
                    text, _ = comments_data[(i * 2 + j) % len(comments_data)]
                    await conn.execute(
                        """INSERT INTO comments (lesson_id, user_id, content, created_at)
                           VALUES ($1, $2, $3, CURRENT_TIMESTAMP - (random() * interval '20 days'))""",
                        lesson['lesson_id'], s['user_id'], text,
                    )

        # ----- More courses for richer store UI -----
        teacher_for_new = await conn.fetchval(
            "SELECT user_id FROM teachers ORDER BY user_id LIMIT 1"
        )
        # Get teacher IDs for variety
        all_teachers = await conn.fetch("SELECT user_id FROM teachers")
        extra_courses = [
            ('Giao tiếp Ngôn ngữ Ký hiệu nâng cao',     850000.00, 'PUBLISHED', 1, 'Khóa học nâng cao dành cho người đã có nền tảng'),
            ('Ngôn ngữ Ký hiệu cho giáo viên',          1200000.00, 'PUBLISHED', 0, 'Đào tạo giáo viên giảng dạy NNKH chuyên nghiệp'),
            ('Ngôn ngữ Ký hiệu trẻ em',                  450000.00, 'PUBLISHED', 1, 'Phương pháp dạy NNKK cho trẻ em từ 3-10 tuổi'),
            ('Văn hóa cộng đồng Người Điếc Việt Nam',    350000.00, 'DRAFT',     0, 'Tìm hiểu văn hóa, lịch sử cộng đồng người Điếc'),
        ]
        for title, price, status, teacher_idx, desc in extra_courses:
            existing = await conn.fetchval(
                "SELECT course_id FROM general_courses WHERE title=$1", title
            )
            if not existing:
                teacher_id = all_teachers[teacher_idx % len(all_teachers)]['user_id']
                cid = await conn.fetchval(
                    """INSERT INTO general_courses
                       (title, price, teacher_id, category_id, description, visibility_status)
                       VALUES ($1,$2,$3,$4,$5,$6) RETURNING course_id""",
                    title, price, teacher_id, 1, desc, status,
                )
                # Add one module + two lessons to each new course
                mid = await conn.fetchval(
                    """INSERT INTO general_course_modules (course_id, title, order_index)
                       VALUES ($1, 'Chương mở đầu', 1) RETURNING module_id""",
                    cid,
                )
                await conn.execute(
                    """INSERT INTO general_course_lessons (module_id, title, video_url, order_index)
                       VALUES ($1, 'Bài giới thiệu khóa học', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 1)""",
                    mid,
                )
                await conn.execute(
                    """INSERT INTO general_course_lessons (module_id, title, video_url, order_index)
                       VALUES ($1, 'Bài tổng quan nội dung', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 2)""",
                    mid,
                )

        # ----- A few extra enrollments so progress shows up nicely -----
        published_courses = await conn.fetch(
            "SELECT course_id FROM general_courses WHERE visibility_status='PUBLISHED'"
        )
        for i, s in enumerate(all_students):
            for j, c in enumerate(published_courses):
                if (i + j) % 3 == 0:  # each student enrolls in some courses
                    exists = await conn.fetchval(
                        "SELECT 1 FROM course_enrollments WHERE student_id=$1 AND course_id=$2",
                        s['user_id'], c['course_id'],
                    )
                    if not exists:
                        progress = 10.0 + ((i * 13 + j * 17) % 85)
                        await conn.execute(
                            """INSERT INTO course_enrollments (student_id, course_id, progress)
                               VALUES ($1, $2, $3) ON CONFLICT DO NOTHING""",
                            s['user_id'], c['course_id'], progress,
                        )

        print("Augment seed completed.")
    except Exception as e:
        print(f"Error: {e}")
        raise
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
