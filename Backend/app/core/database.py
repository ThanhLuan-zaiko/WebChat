"""
Database connection and session management.
Uses async SQLAlchemy with asyncpg driver.
"""
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import settings


# Create async engine
# Using NullPool for better compatibility with async
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,  # Log SQL queries in debug mode
    poolclass=NullPool,
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency injection for database session.
    Usage in FastAPI:
        @app.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database connection (called on startup)."""
    # Test connection
    async with engine.begin() as conn:
        await conn.run_sync(lambda _: None)


async def close_db() -> None:
    """Close database connection (called on shutdown)."""
    await engine.dispose()
