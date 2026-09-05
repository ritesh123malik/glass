"""SQLAlchemy async engine + session factory + get_db dependency."""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


async def get_db():
    """FastAPI dependency: yields AsyncSession, rolls back on error."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
