import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.router import api_router
from app.core.cache import cache
from app.core.config import settings
from app.core.database import async_session, engine


async def _refresh_leaderboard_periodically():
    """Refresh mv_leaderboard every LEADERBOARD_REFRESH_MINUTES."""
    while True:
        await asyncio.sleep(settings.LEADERBOARD_REFRESH_MINUTES * 60)
        try:
            async with async_session() as db:
                await db.execute(
                    text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard")
                )
                await db.commit()
                # Also sync Redis ZSET if enabled
                if settings.REDIS_ENABLED and cache.enabled:
                    from app.services.gamification import refresh_leaderboard
                    await refresh_leaderboard(db)
        except Exception as e:
            print(f"[Leaderboard Refresh] Failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: verify DB connection
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
        print(f"Database connected: {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")
    # Redis connect
    if settings.REDIS_ENABLED:
        await cache.connect()
        print("Redis connected")

    # Start periodic leaderboard refresh
    refresh_task = asyncio.create_task(_refresh_leaderboard_periodically())

    yield

    # Shutdown
    refresh_task.cancel()
    try:
        await refresh_task
    except asyncio.CancelledError:
        pass

    if settings.REDIS_ENABLED:
        await cache.disconnect()
        print("Redis disconnected")
    await engine.dispose()
    print("Database disconnected")


app = FastAPI(
    title=settings.APP_NAME,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — match Go's permissive config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS", "PUT", "DELETE"],
    allow_headers=[
        "Accept",
        "Content-Type",
        "Content-Length",
        "Accept-Encoding",
        "X-CSRF-Token",
        "Authorization",
        "Session-Key",
    ],
)

app.include_router(api_router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "FastAPI E-Learning API is running"}
