"""Transaction isolation level context managers for PostgreSQL."""
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@asynccontextmanager
async def serializable(db: AsyncSession):
    """Execute block in SERIALIZABLE isolation.
    Use for: wallet transfers, course purchases, any financial tx."""
    await db.execute(text("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"))
    try:
        yield db
        await db.commit()
    except Exception:
        await db.rollback()
        raise


@asynccontextmanager
async def repeatable_read(db: AsyncSession):
    """Execute block in REPEATABLE READ isolation.
    Use for: reports that need consistent snapshots."""
    await db.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ"))
    try:
        yield db
        await db.commit()
    except Exception:
        await db.rollback()
        raise


@asynccontextmanager
async def read_committed(db: AsyncSession):
    """Execute block in READ COMMITTED (PostgreSQL default).
    Use for: general CRUD, catalog browsing, search."""
    await db.execute(text("SET TRANSACTION ISOLATION LEVEL READ COMMITTED"))
    try:
        yield db
        await db.commit()
    except Exception:
        await db.rollback()
        raise
