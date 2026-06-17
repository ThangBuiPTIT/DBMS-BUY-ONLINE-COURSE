import asyncio, asyncpg

async def inspect(db_name):
    conn = await asyncpg.connect(
        host='localhost', port=5432,
        user='postgres', password='Chiendp1ln@',
        database=db_name, timeout=5
    )
    print(f"\n=== DB: {db_name} ===")
    tables = await conn.fetch(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema='public' ORDER BY table_name;"
    )
    print(f"Tables ({len(tables)}):")
    for r in tables:
        print("  -", r['table_name'])
    views = await conn.fetch(
        "SELECT table_name FROM information_schema.views "
        "WHERE table_schema='public' ORDER BY table_name;"
    )
    print(f"Views ({len(views)}):")
    for r in views:
        print("  -", r['table_name'])
    await conn.close()

async def main():
    for db in ['final', 'postgres']:
        try:
            await inspect(db)
        except Exception as e:
            print(f"SKIP {db}: {e}")

asyncio.run(main())
