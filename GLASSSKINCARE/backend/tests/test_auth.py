"""Test /auth/admin-login and /auth/verify-shopify-token routes."""
import uuid
import pytest
from unittest.mock import AsyncMock, patch
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.main import app
from app.database import AsyncSessionLocal
from app.models.user import User
from app.services.password_service import hash_password


@pytest.fixture
async def db() -> AsyncSession:
    """Yield a fresh DB session for test setup (creating users, etc.)."""
    async with AsyncSessionLocal() as session:
        yield session


@pytest.fixture
async def client():
    """Async HTTP client bound to the FastAPI app via ASGI transport."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture(autouse=True)
def mock_rate_limit():
    """No-op rate limit so tests don't hit Redis. Patches the binding used by the auth router."""
    with patch("app.routers.auth.rate_limit", new=AsyncMock()):
        yield


@pytest.mark.asyncio
async def test_admin_login_success(client, db):
    """Admin with correct password gets a bearer token."""
    email = f"admin-{uuid.uuid4()}@test.com"
    user = User(email=email, is_admin=True, password_hash=hash_password("secret123"))
    db.add(user)
    await db.commit()

    r = await client.post("/auth/admin-login", json={"email": email, "password": "secret123"})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_admin_login_wrong_password(client, db):
    """Wrong password returns 401."""
    email = f"admin-{uuid.uuid4()}@test.com"
    user = User(email=email, is_admin=True, password_hash=hash_password("secret123"))
    db.add(user)
    await db.commit()

    r = await client.post("/auth/admin-login", json={"email": email, "password": "wrong"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_admin_login_not_admin(client, db):
    """Non-admin user with valid password returns 403 (not 200)."""
    email = f"user-{uuid.uuid4()}@test.com"
    user = User(email=email, is_admin=False, password_hash=hash_password("secret123"))
    db.add(user)
    await db.commit()

    r = await client.post("/auth/admin-login", json={"email": email, "password": "secret123"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_admin_login_unknown_email(client):
    """Unknown email returns 401 (don't leak whether user exists)."""
    r = await client.post(
        "/auth/admin-login",
        json={"email": f"nobody-{uuid.uuid4()}@test.com", "password": "whatever"},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_verify_shopify_token_creates_user(client):
    """Valid Shopify token returns user info and creates a new user with no skin profile."""
    customer_id = f"gid://shopify/Customer/{uuid.uuid4()}"
    email = f"shopify-{uuid.uuid4()}@test.com"
    mock_verify = AsyncMock(return_value={"customer_id": customer_id, "email": email})

    with patch("app.routers.auth.verify_shopify_customer_token", new=mock_verify):
        r = await client.post(
            "/auth/verify-shopify-token", json={"shopify_customer_token": "valid"}
        )

    assert r.status_code == 200
    body = r.json()
    assert body["email"] == email
    assert body["has_skin_profile"] is False


@pytest.mark.asyncio
async def test_verify_shopify_token_invalid(client):
    """Invalid Shopify token returns 401."""
    mock_verify = AsyncMock(return_value=None)

    with patch("app.routers.auth.verify_shopify_customer_token", new=mock_verify):
        r = await client.post(
            "/auth/verify-shopify-token", json={"shopify_customer_token": "bad"}
        )

    assert r.status_code == 401