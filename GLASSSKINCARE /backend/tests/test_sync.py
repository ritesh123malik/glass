import pytest
import hmac
import hashlib
import base64
import json
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.config import settings

def get_hmac_header(body: bytes) -> str:
    secret = settings.SHOPIFY_WEBHOOK_SECRET.encode()
    digest = hmac.new(secret, body, hashlib.sha256).digest()
    return base64.b64encode(digest).decode()

@pytest.mark.asyncio
async def test_product_updated_rejects_invalid_hmac():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/sync/product-updated",
            json={"id": 12345},
            headers={"X-Shopify-Hmac-Sha256": "invalidhmac"}
        )
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_product_updated_accepts_valid_hmac():
    body = json.dumps({"id": 12345}).encode()
    valid_hmac = get_hmac_header(body)
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/sync/product-updated",
            content=body,
            headers={"X-Shopify-Hmac-Sha256": valid_hmac, "Content-Type": "application/json"}
        )
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
