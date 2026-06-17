"""Reset bcrypt password for seeded student/teacher users so they can log in.

Usage:
    cd backend
    python reset_seeded_users.py
"""
import asyncio

import asyncpg

from app.core.config import settings
from app.core.security import hash_password

ACCOUNTS = [
    ("student1", "student123", "STUDENT"),
    ("student2", "student123", "STUDENT"),
    ("student3", "student123", "STUDENT"),
    ("student4", "student123", "STUDENT"),
    ("student5", "student123", "STUDENT"),
    ("teacher1", "teacher123", "TEACHER"),
    ("teacher2", "teacher123", "TEACHER"),
    ("teacher3", "teacher123", "TEACHER"),
]


async def reset_accounts():
    conn = await asyncpg.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database=settings.DB_NAME,
    )
    try:
        for username, password, expected_role in ACCOUNTS:
            row = await conn.fetchrow(
                """
                SELECT u.user_id, r.role_name
                FROM users u JOIN roles r ON r.role_id = u.role_id
                WHERE u.username = $1
                """,
                username,
            )
            if row is None:
                print(f"  SKIP {username}: not found")
                continue

            if row["role_name"] != expected_role:
                print(
                    f"  SKIP {username}: expected {expected_role}, got {row['role_name']}"
                )
                continue

            new_hash = hash_password(password)
            await conn.execute(
                "UPDATE users SET password_hash = $1 WHERE user_id = $2",
                new_hash,
                row["user_id"],
            )
            print(f"  RESET {username} / {password}  (role={expected_role})")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(reset_accounts())
    print("Done.")
