"""Test database engine + session factory."""
import pytest
from sqlalchemy import text
from app.database import engine, get_db


def test_engine_creates_async_engine():
    """Engine is async and bound to DATABASE_URL."""
    assert engine is not None
    assert "postgresql+asyncpg" in str(engine.url)


@pytest.mark.asyncio
async def test_can_connect_to_postgres():
    """Engine can execute SELECT 1 against running Postgres."""
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT 1"))
        assert result.scalar() == 1


@pytest.mark.asyncio
async def test_get_db_yields_session():
    """get_db dependency yields a session that can query."""
    async for session in get_db():
        result = await session.execute(text("SELECT current_database()"))
        db_name = result.scalar()
        assert db_name == "glass_skincare"
        break
