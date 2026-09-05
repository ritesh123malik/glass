"""Tests for admin router endpoints."""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy import select
from app import database as _db_module
from app.main import app
from app.services.jwt_service import create_access_token
from app.models.user import User

ADMIN_TOKEN = create_access_token({"sub": "00000000-0000-0000-0000-000000000001", "is_admin": True})
USER_TOKEN = create_access_token({"sub": "00000000-0000-0000-0000-000000000002", "is_admin": False})


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def admin_headers():
    return {"Authorization": f"Bearer {ADMIN_TOKEN}"}


@pytest.fixture
def user_headers():
    return {"Authorization": f"Bearer {USER_TOKEN}"}


@pytest_asyncio.fixture(autouse=True)
async def disable_rate_limit():
    """Disable Redis rate limiting for all admin route tests."""
    with patch("app.routers.admin.rate_limit", new_callable=AsyncMock):
        yield


@pytest_asyncio.fixture(autouse=True)
async def ensure_admin_user(_test_engine):
    """Ensure admin user exists — idempotent, runs before each admin test.
    Uses the function-scoped test engine (see conftest._test_engine)."""
    session_factory = _db_module.AsyncSessionLocal
    async with session_factory() as session:
        existing = await session.execute(
            select(User).where(User.id == "00000000-0000-0000-0000-000000000001")
        )
        if existing.scalar_one_or_none() is None:
            admin = User(
                id="00000000-0000-0000-0000-000000000001",
                email="admin@test.com",
                is_admin=True,
            )
            session.add(admin)
            await session.commit()
    yield


@pytest.mark.asyncio
async def test_parse_command_requires_admin(client):
    r = await client.post("/admin/parse-command", json={"command": "show orders"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_parse_command_success(client, admin_headers):
    with patch("app.routers.admin.parse_admin_command") as mock_parse:
        mock_parse.return_value = {
            "action": "filter_orders",
            "description": "Show pending orders",
            "requires_confirmation": False,
            "params": {},
            "estimated_impact": "10 orders",
        }
        r = await client.post(
            "/admin/parse-command",
            json={"command": "show pending orders"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["action"] == "filter_orders"


@pytest.mark.asyncio
async def test_dashboard_returns_counts(client, admin_headers):
    r = await client.get("/admin/dashboard", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert "total_users" in data
    assert "conversations_last_7d" in data
    assert "low_stock_products" in data


@pytest.mark.asyncio
async def test_dashboard_requires_admin(client):
    r = await client.get("/admin/dashboard")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_orders_returns_empty_list_when_no_shopify_config(client, admin_headers):
    with patch("app.routers.admin.settings") as mock_settings:
        mock_settings.SHOPIFY_ADMIN_API_TOKEN = ""
        mock_settings.SHOPIFY_STORE_DOMAIN = ""
        r = await client.get("/admin/orders", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["orders"] == []


@pytest.mark.asyncio
async def test_orders_requires_admin(client):
    r = await client.get("/admin/orders")
    assert r.status_code == 401
