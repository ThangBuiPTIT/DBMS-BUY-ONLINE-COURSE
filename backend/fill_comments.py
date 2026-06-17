"""Fill comments table only."""
import asyncio
import asyncpg

DB = dict(host='localhost', port=5432, user='postgres', password='Chiendp1ln@', database='postgres')


async def main():
    conn = await asyncpg.connect(**DB)
    try:
        lessons = await conn.fetch(
            """SELECT l.lesson_id FROM general_course_lessons l
               JOIN general_course_modules m ON l.module_id = m.module_id
               JOIN general_courses c ON m.course_id = c.course_id
               WHERE c.visibility_status='PUBLISHED' LIMIT 5"""
        )
        students = await conn.fetch("SELECT user_id FROM students")
        print(f"Found {len(lessons)} lessons, {len(students)} students")

        comments_data = [
            'Bài học rất dễ hiểu, cảm ơn thầy/cô!',
            'Video hơi nhanh, mong có phần giải thích chậm hơn',
            'Tôi đã học được rất nhiều điều bổ ích',
            'Phần thực hành cần thêm ví dụ cụ thể hơn',
            'Hoàn hảo cho người mới bắt đầu',
            'Bài tập cuối hơi khó, cần thêm gợi ý',
            'Nội dung trình bày rõ ràng, dễ theo dõi',
            'Mong tác giả ra thêm phần 2',
        ]
        count = 0
        for i, lesson in enumerate(lessons):
            n_comments = 2 + (i % 2)
            for j in range(n_comments):
                s = students[(i * 2 + j) % len(students)]
                text = comments_data[(i * 2 + j) % len(comments_data)]
                await conn.execute(
                    """INSERT INTO comments (lesson_id, user_id, content, created_at)
                       VALUES ($1, $2, $3, CURRENT_TIMESTAMP - (random() * interval '20 days'))""",
                    lesson['lesson_id'], s['user_id'], text,
                )
                count += 1
        print(f"Inserted {count} comments")
        total = await conn.fetchval("SELECT count(*) FROM comments")
        print(f"Total comments: {total}")
    finally:
        await conn.close()


asyncio.run(main())
