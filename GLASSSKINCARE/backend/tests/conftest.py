"""Pytest fixtures for database + HTTP tests.

NOTE: pytest-asyncio 0.24 + asyncpg is fragile under loop_scope=session —
asyncpg connections bind to whichever loop first opens them, and pytest-asyncio
will reuse/close the loop between fixtures and tests, producing
"got Future ... attached to a different loop" errors.

The fix used here: make the engine FUNCTION-scoped (new engine per test) and
patch app.database + every test module's `AsyncSessionLocal` to point at the
fresh per-test engine. This is slower (~10ms/test) but reliable, and matches
the existing test isolation philosophy (drop_all + create_all per test).
"""
import sys
import uuid
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app import database as _db_module
from app.config import settings
from app.database import Base, get_db
from app.main import app as fastapi_app
from app.models.user import User
from app.services.password_service import hash_password


# Routers that call `rate_limit(request, ...)` directly. Stub them all in tests
# so the suite doesn't burn through the per-IP Redis rate-limit counters and
# produce flaky 429s on /auth/admin-login (max 5/min).
_RATE_LIMIT_ROUTERS = (
    "app.routers.auth",
    "app.routers.admin",
    "app.routers.ai",
)


@pytest.fixture(autouse=True)
def _disable_rate_limit():
    """No-op the rate_limit dependency across every router for every test.
    test_rate_limit.py patches `app.middleware.rate_limit.rate_limit`
    directly, so leave that module alone — only stub the per-router imports."""
    patches = [
        patch(f"{mod}.rate_limit", new_callable=AsyncMock)
        for mod in _RATE_LIMIT_ROUTERS
    ]
    for p in patches:
        p.start()
    yield
    for p in patches:
        p.stop()


@pytest_asyncio.fixture(autouse=True)
async def _test_engine():
    """Function-scoped engine. Bound to this test's loop. Patches
    app.database.engine + AsyncSessionLocal AND rebinds `AsyncSessionLocal` in
    any already-imported test module so direct imports resolve to the patched
    factory."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    test_factory = async_sessionmaker(engine, expire_on_commit=False)
    _db_module.engine = engine
    _db_module.AsyncSessionLocal = test_factory
    for mod_name, mod in list(sys.modules.items()):
        if mod is None or not mod_name.startswith("tests."):
            continue
        if hasattr(mod, "AsyncSessionLocal"):
            try:
                mod.AsyncSessionLocal = test_factory
            except (AttributeError, TypeError):
                pass
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def async_session(_test_engine):
    """A fresh async DB session per test. Tables are already created by
    _test_engine's autouse; we just hand out a session."""
    session_factory = async_sessionmaker(_test_engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def sample_admin(async_session: AsyncSession):
    """Insert a known admin user with a 12+ char password and return it.
    Uses example.com — Pydantic EmailStr rejects `.test` as a reserved TLD."""
    user = User(
        id=uuid.uuid4(),
        email="admin-test@example.com",
        is_admin=True,
        password_hash=hash_password("test-password-12chars"),
        token_version=1,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def async_client(async_session: AsyncSession):
    """An httpx AsyncClient wired to the FastAPI app with the test DB
    session injected as a get_db override."""
    async def _override_get_db():
        yield async_session

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    fastapi_app.dependency_overrides.clear()
