"""Tests for AI service — mocks Claude API calls."""
import pytest
from unittest.mock import AsyncMock, patch


class MockBlock:
    def __init__(self, text):
        self.text = text


class MockMessage:
    def __init__(self, text):
        self.content = [MockBlock(text)]


@pytest.mark.asyncio
async def test_build_skin_routine_parses_json():
    from app.services.ai_service import build_skin_routine

    mock_response = MockMessage(
        '{"skin_profile_summary":"test","morning_routine":[],"evening_routine":[],"routine_goal":"test"}'
    )

    with patch("app.services.ai_service.client") as mock_client:
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        result = await build_skin_routine({"skin_type": "oily"}, "product catalog")
        assert result["skin_profile_summary"] == "test"


@pytest.mark.asyncio
async def test_parse_admin_command_returns_action():
    from app.services.ai_service import parse_admin_command

    mock_response = MockMessage(
        '{"action":"filter_orders","description":"show orders","requires_confirmation":false,"params":{}}'
    )

    with patch("app.services.ai_service.client") as mock_client:
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        result = await parse_admin_command("show pending orders")
        assert result["action"] == "filter_orders"


@pytest.mark.asyncio
async def test_analyze_skin_photo():
    from app.services.ai_service import analyze_skin_photo

    mock_response = MockMessage(
        '{"skin_type":"oily","concerns":["acne"],"concern_details":{},"overall_skin_health":"fair","confidence":0.8}'
    )

    with patch("app.services.ai_service.client") as mock_client:
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        result = await analyze_skin_photo("base64imagedata", "image/jpeg")
        assert result["skin_type"] == "oily"


@pytest.mark.asyncio
async def test_build_skin_routine_strips_json_code_fence():
    from app.services.ai_service import build_skin_routine

    mock_response = MockMessage(
        '```json\n{"skin_profile_summary":"oily skin","morning_routine":[],"evening_routine":[],"routine_goal":"clear skin"}\n```'
    )

    with patch("app.services.ai_service.client") as mock_client:
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        result = await build_skin_routine({"skin_type": "oily"}, "product catalog")
        assert result["skin_profile_summary"] == "oily skin"


@pytest.mark.asyncio
async def test_parse_admin_command_strips_code_fence():
    from app.services.ai_service import parse_admin_command

    mock_response = MockMessage(
        '```json\n{"action":"unknown","description":"unclear","requires_confirmation":false,"params":{}}\n```'
    )

    with patch("app.services.ai_service.client") as mock_client:
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        result = await parse_admin_command("gibberish command")
        assert result["action"] == "unknown"


@pytest.mark.asyncio
async def test_analyze_skin_photo_strips_code_fence():
    from app.services.ai_service import analyze_skin_photo

    mock_response = MockMessage(
        '```json\n{"skin_type":"dry","concerns":["dryness"],"concern_details":{},"overall_skin_health":"good","confidence":0.9}\n```'
    )

    with patch("app.services.ai_service.client") as mock_client:
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        result = await analyze_skin_photo("base64data", "image/jpeg")
        assert result["skin_type"] == "dry"
