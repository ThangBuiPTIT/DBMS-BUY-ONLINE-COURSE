"""Insert/update admin user with proper bcrypt hash for password 'admin123'."""
import asyncio

import asyncpg

from app.core.config import settings
from app.core.security import hash_password


async def ensure_admin():
    conn = await asyncpg.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database=settings.DB_NAME,
    )
    try:
        await conn.execute(
            "INSERT INTO roles (role_name) VALUES ('ADMIN') ON CONFLICT (role_name) DO NOTHING"
        )
        admin_role = await conn.fetchval(
            "SELECT role_id FROM roles WHERE role_name = 'ADMIN'"
        )

        new_hash = hash_password("admin123")
        result = await conn.execute(
            """
            INSERT INTO users (username, password_hash, email, role_id, status)
            VALUES ('admin', $1, 'admin@elearning.com', $2, 'active')
            ON CONFLICT (username) DO UPDATE
              SET password_hash = EXCLUDED.password_hash,
                  role_id = EXCLUDED.role_id,
                  status = 'active'
            """,
            new_hash,
            admin_role,
        )
        print(f"Upsert admin: {result}")

        admin_user_id = await conn.fetchval(
            "SELECT user_id FROM users WHERE username = 'admin'"
        )
        print(f"admin user_id: {admin_user_id}")

        await conn.execute(
            """
            INSERT INTO user_profiles (user_id, full_name, date_of_birth, phone_number)
            VALUES ($1, 'System Admin', '1990-01-01', '0999999999')
            ON CONFLICT (user_id) DO NOTHING
            """,
            admin_user_id,
        )
        print("Profile inserted/updated.")
        print("Done. Login with admin / admin123.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(ensure_admin())