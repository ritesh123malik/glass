"""Shopify dependency."""
import base64
import hashlib
import hmac
from fastapi import Header, HTTPException, Request
from app.config import settings

async def verify_shopify_hmac(
    request: Request,
    x_shopify_hmac_sha256: str | None = Header(default=None, description="Shopify HMAC signature"),
) -> bytes:
    """Verify Shopify webhook signature. Returns 401 for missing or bad HMAC."""
    body = await request.body()
    if not x_shopify_hmac_sha256:
        raise HTTPException(status_code=401, detail="Missing webhook signature")
    secret = settings.SHOPIFY_WEBHOOK_SECRET.encode()
    digest = hmac.new(secret, body, hashlib.sha256).digest()
    expected = base64.b64encode(digest).decode()
    if not hmac.compare_digest(expected, x_shopify_hmac_sha256):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    return body
