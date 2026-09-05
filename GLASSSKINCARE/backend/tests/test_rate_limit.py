import pytest
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
from app.middleware.rate_limit import rate_limit

class FakeRequest:
    def __init__(self, client_host="1.2.3.4", path="/test"):
        self.client = type("Client", (), {"host": client_host})()
        self.url = type("URL", (), {"path": path})()

@pytest.mark.asyncio
async def test_first_request_passes():
    with patch("app.middleware.rate_limit.get_redis") as mock_get:
        mock_r = AsyncMock()
        mock_r.incr = AsyncMock(return_value=1)
        mock_get.return_value = mock_r

        req = FakeRequest()
        await rate_limit(req, max_calls=5, window_seconds=60)  # no exception

@pytest.mark.asyncio
async def test_exceeds_limit_raises():
    with patch("app.middleware.rate_limit.get_redis") as mock_get:
        mock_r = AsyncMock()
        mock_r.incr = AsyncMock(return_value=6)  # over 5
        mock_get.return_value = mock_r

        req = FakeRequest()
        with pytest.raises(HTTPException) as exc:
            await rate_limit(req, max_calls=5, window_seconds=60)
        assert exc.value.status_code == 429
