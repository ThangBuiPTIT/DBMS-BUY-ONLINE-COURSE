"""End-to-end smoke test for the 3 login endpoints + role guards."""
import asyncio
import json

import httpx


async def login(client, endpoint, username, password):
    r = await client.post(
        f"http://127.0.0.1:8000{endpoint}",
        json={"username": username, "password": password},
    )
    print(f"POST {endpoint}  status={r.status_code}")
    try:
        body = r.json()
    except Exception:
        body = r.text
    if isinstance(body, dict) and "session_key" in body:
        print("  body:", json.dumps(body, ensure_ascii=False)[:300])
        return body["session_key"]
    if isinstance(body, dict) and "detail" in body:
        print("  body:", json.dumps(body, ensure_ascii=False)[:200])
    else:
        print("  body:", str(body)[:200])
    return None


async def get_user_id(client, session_key):
    """Decode user_id from /api/admin/audit-logs which echoes nothing; we use a known-good endpoint."""
    # We don't have /api/users/me. Use audit-logs as probe — admin only, but role check returns 403 for non-admin.
    # Instead, since we know seed user_ids, we just call student streak (any role auth) which returns user info.
    r = await client.get(
        "http://127.0.0.1:8000/api/gamification/streak/00000000-0000-0000-0000-000000000000",
        headers={"Session-Key": session_key},
    )
    # This returns 404 with no user info, so not useful. Use notifications instead.
    # notifications returns list; but it filters by user_id. We need our own user_id.
    # Skip and let the script read user_id directly from session row via asyncpg if needed.
    return None


async def get_with(client, path, session_key):
    r = await client.get(
        f"http://127.0.0.1:8000{path}", headers={"Session-Key": session_key}
    )
    print(f"GET {path}  status={r.status_code}")
    try:
        body = r.json()
        if isinstance(body, list):
            print(
                f"  -> list len={len(body)}; first:",
                json.dumps(body[0], default=str, ensure_ascii=False)[:200]
                if body
                else "[]",
            )
        elif isinstance(body, dict):
            print(f"  -> keys: {list(body.keys())}")
            print("  -> sample:", json.dumps(body, default=str, ensure_ascii=False)[:300])
    except Exception:
        print("  body:", r.text[:200])


async def main():
    async with httpx.AsyncClient(timeout=15) as client:
        print("=== HEALTH ===")
        r = await client.get("http://127.0.0.1:8000/api/health")
        print(" ", r.json())

        print()
        print("=== ADMIN LOGIN ===")
        sk_admin = await login(client, "/api/auth/admin-login", "admin", "admin123")

        print()
        print("=== STUDENT LOGIN ===")
        sk_student = await login(client, "/api/auth/student-login", "student1", "student123")

        print()
        print("=== TEACHER LOGIN ===")
        sk_teacher = await login(client, "/api/auth/teacher-login", "teacher1", "teacher123")

        print()
        print("=== Cross-role checks ===")
        r = await client.post(
            "http://127.0.0.1:8000/api/auth/admin-login",
            json={"username": "student1", "password": "student123"},
        )
        print(f"  student1 -> /admin-login: {r.status_code}  {r.json().get('detail')}")

        r = await client.post(
            "http://127.0.0.1:8000/api/auth/student-login",
            json={"username": "admin", "password": "admin123"},
        )
        print(f"  admin -> /student-login: {r.status_code}  {r.json().get('detail')}")

        r = await client.post(
            "http://127.0.0.1:8000/api/auth/teacher-login",
            json={"username": "teacher1", "password": "wrong"},
        )
        print(f"  teacher1 wrong pw -> /teacher-login: {r.status_code}  {r.json().get('detail')}")

        print()
        print("=== Use sessions to hit authenticated endpoints ===")
        if sk_admin:
            await get_with(client, "/api/admin/transactions?limit=3", sk_admin)
            await get_with(client, "/api/admin/audit-logs", sk_admin)

        if sk_teacher:
            # We need teacher1's user_id. Read from DB.
            import asyncpg
            conn = await asyncpg.connect(
                "postgresql://postgres:Chiendp1ln%40@localhost:5432/postgres"
            )
            teacher_id = await conn.fetchval(
                "SELECT user_id FROM users WHERE username='teacher1'"
            )
            student_id = await conn.fetchval(
                "SELECT user_id FROM users WHERE username='student1'"
            )
            await conn.close()
            await get_with(client, f"/api/teacher/{teacher_id}/dashboard", sk_teacher)
            await get_with(client, f"/api/teacher/{teacher_id}/courses", sk_teacher)

        if sk_student:
            await get_with(
                client, f"/api/gamification/streak/{student_id}", sk_student
            )
            await get_with(
                client, f"/api/notifications/{student_id}", sk_student
            )

        print()
        print("=== Logout ===")
        if sk_student:
            r = await client.post(
                "http://127.0.0.1:8000/api/auth/logout",
                json={"session_key": sk_student},
            )
            print(f"  logout student1 session: {r.status_code}  {r.json()}")
            r = await client.get(
                "http://127.0.0.1:8000/api/admin/transactions?limit=1",
                headers={"Session-Key": sk_student},
            )
            print(
                f"  reuse revoked session on admin endpoint: {r.status_code}  body[:120]={str(r.json())[:120]}"
            )


if __name__ == "__main__":
    asyncio.run(main())
