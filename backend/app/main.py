from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import engine
from app.api.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: verify DB connection
    async with engine.connect() as conn:
        await conn.execute(
            __import__("sqlalchemy").text("SELECT 1")
        )
        print(f"Database connected: {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")
    yield
    # Shutdown
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
