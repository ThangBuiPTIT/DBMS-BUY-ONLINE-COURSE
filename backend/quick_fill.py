"""Quick fill: comments, achievements, user_achievements for already-seeded DB."""
import asyncio
from datetime import date
import asyncpg

DB = dict(host='localhost', port=5432, user='postgres', password='Chiendp1ln@', database='postgres')


async def main():
    conn = await asyncpg.connect(**DB)
    try:
        # achievements
        rows = [
            ('Lần đầu đăng nhập', 'Chào mừng bạn đến với E-Learning!', '🌟'),
            ('Khóa học đầu tiên', 'Hoàn thành việc mua khóa học đầu tiên', '🎓'),
            ('Streak 3 ngày', 'Học liên tục 3 ngày liên tiếp', '🔥'),
            ('Streak 7 ngày', 'Học liên tục 7 ngày liên tiếp', '🔥'),
            ('Streak 30 ngày', 'Học liên tục 30 ngày liên tiếp', '💎'),
            ('Bậc thầy Quiz', 'Đạt điểm tuyệt đối 10 bài quiz microlearning', '🧠'),
            ('Top 10 bảng xếp hạng', 'Lọt vào Top 10 học viên xuất sắc', '🏆'),
            ('Hoàn thành khóa học', 'Hoàn thành 100% một khóa học bất kỳ', '✅'),
        ]
        ach_ids = {}
        for name, desc, icon in rows:
            aid = await conn.fetchval(
                """INSERT INTO achievements (title, description, icon_url)
                   SELECT $1::varchar, $2::text, $3::varchar
                   WHERE NOT EXISTS (SELECT 1 FROM achievements WHERE title=$1::varchar)
                   RETURNING achievement_id""",
                name, desc, icon,
            )
            if not aid:
                aid = await conn.fetchval("SELECT achievement_id FROM achievements WHERE title=$1", name)
            ach_ids[name] = aid

        print(f"Achievements: {ach_ids}")

        # student_streaks
        students = await conn.fetch("SELECT user_id FROM students")
        for s in students:
            uid = s['user_id']
            exists = await conn.fetchval("SELECT 1 FROM student_streaks WHERE student_id=$1", uid)
            if not exists:
                await conn.execute(
                    """INSERT INTO student_streaks
                       (student_id, current_streak, highest_streak, last_activity_date)
                       VALUES ($1, $2, $3, $4)""",
                    uid, 7, 14, date(2026, 6, 17),
                )

        # user_achievements
        for s in students:
            uid = s['user_id']
            for name in ['Lần đầu đăng nhập', 'Khóa học đầu tiên']:
                aid = ach_ids[name]
                if not aid:
                    continue
                exists = await conn.fetchval(
                    "SELECT 1 FROM user_achievements WHERE user_id=$1 AND achievement_id=$2",
                    uid, aid,
                )
                if not exists:
                    await conn.execute(
                        """INSERT INTO user_achievements (user_id, achievement_id, earned_at)
                           VALUES ($1, $2, CURRENT_TIMESTAMP - (random() * interval '30 days'))""",
                        uid, aid,
                    )
            aid3 = ach_ids['Streak 3 ngày']
            if aid3:
                exists = await conn.fetchval(
                    "SELECT 1 FROM user_achievements WHERE user_id=$1 AND achievement_id=$2",
                    uid, aid3,
                )
                if not exists:
                    await conn.execute(
                        """INSERT INTO user_achievements (user_id, achievement_id, earned_at)
                           VALUES ($1, $2, CURRENT_TIMESTAMP - (random() * interval '15 days'))""",
                        uid, aid3,
                    )

        # top student extra achievements
        if students:
            uid = students[0]['user_id']
            for n in ['Streak 7 ngày', 'Top 10 bảng xếp hạng']:
                aid = ach_ids.get(n)
                if not aid:
                    continue
                await conn.execute(
                    """INSERT INTO user_achievements (user_id, achievement_id, earned_at)
                       VALUES ($1, $2, CURRENT_TIMESTAMP - interval '5 days')
                       ON CONFLICT DO NOTHING""",
                    uid, aid,
                )

        # comments
        n_before = await conn.fetchval("SELECT count(*) FROM comments")
        lessons = await conn.fetch(
            """SELECT l.lesson_id, l.title FROM general_course_lessons l
               JOIN general_course_modules m ON l.module_id = m.module_id
               JOIN general_courses c ON m.course_id = c.course_id
               WHERE c.visibility_status='PUBLISHED' LIMIT 5"""
        )
        print(f"Found {len(lessons)} published lessons, comments before: {n_before}")
        comments_data = [
            ('Bài học rất dễ hiểu, cảm ơn thầy/cô!', 5),
            ('Video hơi nhanh, mong có phần giải thích chậm hơn', 4),
            ('Tôi đã học được rất nhiều điều bổ ích', 5),
            ('Phần thực hành cần thêm ví dụ cụ thể hơn', 4),
            ('Hoàn hảo cho người mới bắt đầu', 5),
            ('Bài tập cuối hơi khó, cần thêm gợi ý', 4),
            ('Nội dung trình bày rõ ràng, dễ theo dõi', 5),
            ('Mong tác giả ra thêm phần 2', 5),
        ]
        if lessons and students:
            for i, lesson in enumerate(lessons):
                n_comments = 2 + (i % 2)
                for j in range(n_comments):
                    s = students[(i * 2 + j) % len(students)]
                    text, _ = comments_data[(i * 2 + j) % len(comments_data)]
                    await conn.execute(
                        """INSERT INTO comments (lesson_id, user_id, content, created_at)
                           VALUES ($1, $2, $3, CURRENT_TIMESTAMP - (random() * interval '20 days'))""",
                        lesson['lesson_id'], s['user_id'], text,
                    )

        n_after = await conn.fetchval("SELECT count(*) FROM comments")
        print(f"Comments after: {n_after}")

        # verify
        for t in ['comments', 'student_streaks', 'achievements', 'user_achievements']:
            n = await conn.fetchval(f"SELECT count(*) FROM {t}")
            print(f"{t:25} {n}")

    except Exception as e:
        print(f"Error: {e}")
        raise
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
