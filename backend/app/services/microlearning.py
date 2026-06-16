import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_roadmap(db: AsyncSession) -> list[dict]:
    """Get microlearning roadmap from JSON aggregation query."""
    result = await db.execute(
        text("""
            SELECT
                t.topic_id,
                t.title,
                COALESCE(t.description, '') AS description,
                COALESCE(
                    (SELECT json_agg(unit_data ORDER BY unit_data.order_index ASC)
                     FROM (
                         SELECT
                             u.unit_id::text,
                             u.topic_id,
                             u.title,
                             u.order_index,
                             COALESCE(
                                 (SELECT json_agg(lesson_data ORDER BY lesson_data.order_index ASC)
                                  FROM (
                                      SELECT
                                          l.lesson_id::text,
                                          l.unit_id::text,
                                          l.title,
                                          COALESCE(l.video_url, '') AS video_url,
                                          l.order_index
                                      FROM microlearning_lessons l
                                      WHERE l.unit_id = u.unit_id
                                  ) lesson_data
                                 ), '[]'::json
                             ) AS lessons
                         FROM microlearning_units u
                         WHERE u.topic_id = t.topic_id
                     ) unit_data
                    ), '[]'::json
                ) AS units
            FROM microlearning_topics t
            ORDER BY t.topic_id ASC
        """)
    )
    topics = []
    for row in result.mappings():
        topic = dict(row)
        # json_agg returns JSON string; parse to Python list
        if isinstance(topic.get("units"), str):
            topic["units"] = json.loads(topic["units"])
        topics.append(topic)
    return topics


async def get_lesson_parts(db: AsyncSession, lesson_id: str) -> list[dict]:
    """Get parts for a microlearning lesson."""
    result = await db.execute(
        text("""
            SELECT part_id::text, lesson_id::text,
                   COALESCE(title, '') AS title, part_type,
                   COALESCE(content, '') AS content, order_index
            FROM microlearning_lesson_parts
            WHERE lesson_id = :lid
            ORDER BY order_index ASC
        """),
        {"lid": lesson_id},
    )
    return [dict(row) for row in result.mappings()]


async def get_part_questions(db: AsyncSession, part_id: str) -> list[dict]:
    """Get questions for a microlearning part."""
    result = await db.execute(
        text("""
            SELECT question_id::text, part_id::text, question_text,
                   question_type, options_json, correct_answer
            FROM microlearning_questions
            WHERE part_id = :pid
        """),
        {"pid": part_id},
    )
    questions = []
    for row in result.mappings():
        q = dict(row)
        # Parse JSONB options to Python list
        if isinstance(q.get("options_json"), str):
            q["options_json"] = json.loads(q["options_json"])
        questions.append(q)
    return questions
