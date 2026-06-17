import sys
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import settings

if "pytest" in sys.modules:
    engine = create_async_engine(
        settings.DATABASE_URL, echo=settings.DEBUG, poolclass=NullPool,
    )
else:
    engine = create_async_engine(
        settings.DATABASE_URL, echo=settings.DEBUG, pool_size=10, max_overflow=20,
    )

# Read Replica engine (falls back to primary if not configured)
if settings.REPLICA_DATABASE_URL and "pytest" not in sys.modules:
    replica_engine = create_async_engine(
        settings.REPLICA_DATABASE_URL, echo=settings.DEBUG, pool_size=10, max_overflow=20,
    )
else:
    replica_engine = engine

PrimarySession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
ReplicaSession = async_sessionmaker(replica_engine, class_=AsyncSession, expire_on_commit=False)
async_session = PrimarySession  # backward compatibility


async def get_db():
    """Primary DB session (writes)."""
    async with PrimarySession() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_replica_db():
    """Replica DB session (reads). Falls back to primary if not configured."""
    async with ReplicaSession() as session:
        try:
            yield session
        finally:
            await session.close()
