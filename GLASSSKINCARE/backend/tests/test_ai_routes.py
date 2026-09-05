"""Tests for /ai/* routes — session-token, skin-quiz, analyze-skin, recommend."""
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch
from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_session_token_returns_token(client):
    r = await client.get("/ai/session-token")
    assert r.status_code == 200
    data = r.json()
    assert "token" in data
    assert data["expires_in"] == 900


@pytest.mark.asyncio
async def test_skin_quiz_returns_routine(client):
    answers = {"skin_type": "oily", "primary_concern": "acne", "current_routine": "cleanser only", "lifestyle": "outdoors", "budget": "mid"}
    mock_routine = {"skin_profile_summary": "test", "morning_routine": [], "evening_routine": [], "routine_goal": "test"}
    with patch("app.routers.ai.build_skin_routine") as mock_build, \
         patch("app.routers.ai.generate_embedding") as mock_embed, \
         patch("app.middleware.rate_limit.get_redis") as mock_redis:
        mock_build.return_value = mock_routine
        mock_embed.return_value = [0.0] * 384
        mock_r = AsyncMock()
        mock_r.incr = AsyncMock(return_value=1)
        mock_redis.return_value = mock_r
        r = await client.post("/ai/skin-quiz", json={"answers": answers})
        assert r.status_code == 200
        assert r.json()["skin_profile_summary"] == "test"


@pytest.mark.asyncio
async def test_analyze_skin_returns_analysis(client):
    mock_analysis = {"skin_type": "oily", "concerns": ["acne"], "concern_details": {}, "overall_skin_health": "fair", "confidence": 0.8}
    with patch("app.routers.ai.analyze_skin_photo") as mock_analyze, \
         patch("app.routers.ai.generate_embedding") as mock_embed, \
         patch("app.middleware.rate_limit.get_redis") as mock_redis:
        mock_analyze.return_value = mock_analysis
        mock_embed.return_value = [0.0] * 384
        mock_r = AsyncMock()
        mock_r.incr = AsyncMock(return_value=1)
        mock_redis.return_value = mock_r
        r = await client.post("/ai/analyze-skin", json={"image_base64": "abc123", "media_type": "image/jpeg"})
        assert r.status_code == 200
        data = r.json()
        assert data["analysis"]["skin_type"] == "oily"
        assert "recommended_handles" in data


@pytest.mark.asyncio
async def test_recommend_returns_handles(client):
    with patch("app.routers.ai.verify_shopify_customer_token") as mock_verify, \
         patch("app.middleware.rate_limit.get_redis") as mock_redis:
        mock_verify.return_value = {"customer_id": "gid://shopify/Customer/1", "email": "u@test.com"}
        mock_r = AsyncMock()
        mock_r.incr = AsyncMock(return_value=1)
        mock_redis.return_value = mock_r
        r = await client.post("/ai/recommend", json={"shopify_customer_token": "tok"})
        assert r.status_code == 200
        # Without a real DB user with skin_embedding, it falls back to random handles
        assert "recommended_handles" in r.json()
