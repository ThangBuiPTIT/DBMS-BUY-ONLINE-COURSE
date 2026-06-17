import asyncio, asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:Chiendp1ln%40@localhost:5432/postgres')

    expected = ['wallets','users','students','teachers','authentication_sessions','roles','user_profiles','general_courses','course_enrollments','student_streaks','transaction_logs','dictionary_categories','dictionary_entries','general_course_modules','general_course_lessons','achievements','user_achievements','user_feedbacks','comments','learning_materials']
    rows = await conn.fetch(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
    )
    existing = {r['table_name'] for r in rows}
    print('Total tables in public schema:', len(existing))
    print()
    print('Expected key tables check:')
    for t in expected:
        print('  ', 'OK ' if t in existing else 'MISS', t)
    print()

    # users
    print('--- USERS by role ---')
    rows = await conn.fetch(
        'SELECT u.user_id, u.username, r.role_name, u.is_deleted, u.status '
        'FROM users u JOIN roles r ON r.role_id=u.role_id '
        'ORDER BY r.role_name, u.username'
    )
    for r in rows:
        line = '  {role:8s} | {user:30s} | del={d} | st={s}'.format(
            role=r['role_name'], user=r['username'], d=r['is_deleted'], s=r['status']
        )
        print(line)
    print('Total users:', len(rows))

    # wallets
    print()
    print('--- WALLETS ---')
    try:
        wrows = await conn.fetch('SELECT w.user_id, u.username, w.balance FROM wallets w JOIN users u USING(user_id) ORDER BY u.username')
        for r in wrows:
            print('  ', r['username'], '->', r['balance'])
        print('Total wallet rows:', len(wrows))
    except Exception as e:
        print('  ERROR:', e)

    # triggers
    print()
    print('--- TRIGGERS (provision_wallet, student_streak) ---')
    try:
        trows = await conn.fetch(
            "SELECT trigger_name, event_object_table, action_timing, event_manipulation "
            "FROM information_schema.triggers "
            "WHERE trigger_schema='public' AND trigger_name IN ('trg_provision_wallet','trg_create_student_streak')"
        )
        for r in trows:
            print('  ', dict(r))
        if not trows:
            print('  (no triggers found)')
    except Exception as e:
        print('  ERROR:', e)

    # roles
    print()
    print('--- ROLES ---')
    rrows = await conn.fetch('SELECT * FROM roles ORDER BY role_id')
    for r in rrows:
        print('  ', dict(r))

    # sessions
    print()
    print('--- ACTIVE SESSIONS ---')
    srows = await conn.fetch("SELECT session_id, user_id, expires_at FROM authentication_sessions WHERE expires_at > now()")
    for r in srows:
        print('  ', dict(r))
    print('Active sessions:', len(srows))

    await conn.close()

asyncio.run(main())
