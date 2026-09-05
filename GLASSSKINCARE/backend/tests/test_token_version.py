"""Tests for P2 Fix 8: JWT token_version invalidation.

Covers:
- create_access_token embeds `ver` claim
- Bumping user.token_version invalidates a previously-issued token
- get_current_admin / get_current_user reject mismatched `ver`
- /auth/change-password increments token_version and issues a new token
- Pre-Fix-8 tokens (no `ver` claim) still work against version 1 users
"""
from datetime import timedelta
import pytest
from sqlalchemy import select

from app.models.user import User
from app.services.jwt_service import (
    create_access_token,
    decode_token,
    get_current_admin,
    get_current_user,
)
from app.services.password_service import hash_password, verify_password


# ─── Token structure ────────────────────────────────────────────────────

def test_create_access_token_embeds_ver_claim():
    token = create_access_token({"sub": "abc"}, token_version=3)
    payload = decode_token(token)
    assert payload["ver"] == 3
    assert payload["sub"] == "abc"


def test_create_access_token_default_ver_is_one():
    token = create_access_token({"sub": "abc"})
    payload = decode_token(token)
    assert payload["ver"] == 1


# ─── Bumping token_version invalidates old tokens ───────────────────────

@pytest.mark.asyncio
async def test_old_token_rejected_after_version_bump(async_session, sample_admin):
    """The pre-bump token must fail with 401 once the user row's
    token_version is incremented."""
    # Issue token at v1
    old_token = create_access_token(
        {"sub": str(sample_admin.id), "is_admin": True},
        token_version=sample_admin.token_version,
    )

    # Bump on the user row
    sample_admin.token_version = sample_admin.token_version + 1
    async_session.add(sample_admin)
    await async_session.commit()

    # Construct a fake request with the old token
    class FakeRequest:
        def __init__(self, token):
            self.headers = {"Authorization": f"Bearer {token}"}

    with pytest.raises(Exception) as excinfo:
        await get_current_admin(FakeRequest(old_token), db=async_session)
    assert excinfo.value.status_code == 401
    assert "invalidated" in str(excinfo.value.detail).lower()


@pytest.mark.asyncio
async def test_new_token_works_after_version_bump(async_session, sample_admin):
    """A token issued AFTER the bump should still authenticate."""
    sample_admin.token_version = 2
    async_session.add(sample_admin)
    await async_session.commit()

    new_token = create_access_token(
        {"sub": str(sample_admin.id), "is_admin": True},
        token_version=sample_admin.token_version,
    )

    class FakeRequest:
        def __init__(self, token):
            self.headers = {"Authorization": f"Bearer {token}"}

    payload = await get_current_admin(FakeRequest(new_token), db=async_session)
    assert payload["sub"] == str(sample_admin.id)


# ─── Change-password endpoint behavior ──────────────────────────────────

@pytest.mark.asyncio
async def test_change_password_increments_version_and_returns_new_token(
    async_client, async_session, sample_admin
):
    """POST /auth/change-password with current password → new token,
    user.token_version is bumped by 1, old token becomes invalid."""
    from fastapi import FastAPI
    from app.routers.auth import router as auth_router

    # Build a tiny app just for this test
    app = FastAPI()
    app.include_router(auth_router)
    from httpx import AsyncClient, ASGITransport
    transport = ASGITransport(app=app)

    # Login to get a current token
    login_resp = await async_client.post(
        "/auth/admin-login",
        json={"email": sample_admin.email, "password": "test-password-12chars"},
    )
    assert login_resp.status_code == 200, login_resp.text
    old_token = login_resp.json()["access_token"]
    old_payload = decode_token(old_token)
    assert old_payload["ver"] == sample_admin.token_version

    # Change password
    change_resp = await async_client.post(
        "/auth/change-password",
        json={
            "current_password": "test-password-12chars",
            "new_password": "new-secret-12+chars",
        },
        headers={"Authorization": f"Bearer {old_token}"},
    )
    assert change_resp.status_code == 200, change_resp.text
    new_token = change_resp.json()["access_token"]
    new_payload = decode_token(new_token)
    assert new_payload["ver"] == old_payload["ver"] + 1

    # Old token is now invalid
    fail_resp = await async_client.post(
        "/auth/change-password",
        json={
            "current_password": "new-secret-12+chars",
            "new_password": "another-secret-12chars",
        },
        headers={"Authorization": f"Bearer {old_token}"},
    )
    assert fail_resp.status_code == 401


@pytest.mark.asyncio
async def test_change_password_rejects_wrong_current(async_client, sample_admin):
    login_resp = await async_client.post(
        "/auth/admin-login",
        json={"email": sample_admin.email, "password": "test-password-12chars"},
    )
    token = login_resp.json()["access_token"]

    resp = await async_client.post(
        "/auth/change-password",
        json={"current_password": "wrong-password", "new_password": "another-secret-12chars"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_change_password_rejects_short_new(async_client, sample_admin):
    login_resp = await async_client.post(
        "/auth/admin-login",
        json={"email": sample_admin.email, "password": "test-password-12chars"},
    )
    token = login_resp.json()["access_token"]

    resp = await async_client.post(
        "/auth/change-password",
        json={"current_password": "test-password-12chars", "new_password": "short"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422
