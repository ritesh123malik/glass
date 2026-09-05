"""Tests for Shopify Storefront API client."""
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
import httpx
from app.services.shopify_client import verify_shopify_customer_token


@pytest.mark.asyncio
async def test_valid_token():
    """Valid Shopify customer token returns customer data."""
    mock_response = httpx.Response(
        200,
        json={"data": {"customer": {"id": "gid://shopify/Customer/1", "email": "test@example.com"}}},
    )

    mock_client = MagicMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.post = AsyncMock(return_value=mock_response)

    with patch("app.services.shopify_client.settings") as mock_settings, \
         patch("app.services.shopify_client.httpx.AsyncClient", return_value=mock_client):
        mock_settings.SHOPIFY_STORE_DOMAIN = "test.myshopify.com"
        mock_settings.PUBLIC_STOREFRONT_API_TOKEN = "test_token"

        result = await verify_shopify_customer_token("valid_token")
        assert result is not None
        assert result["customer_id"] == "gid://shopify/Customer/1"
        assert result["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_invalid_token():
    """Invalid Shopify customer token returns None."""
    mock_response = httpx.Response(200, json={"data": {"customer": None}})

    mock_client = MagicMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.post = AsyncMock(return_value=mock_response)

    with patch("app.services.shopify_client.settings") as mock_settings, \
         patch("app.services.shopify_client.httpx.AsyncClient", return_value=mock_client):
        mock_settings.SHOPIFY_STORE_DOMAIN = "test.myshopify.com"
        mock_settings.PUBLIC_STOREFRONT_API_TOKEN = "test_token"

        result = await verify_shopify_customer_token("invalid_token")
        assert result is None
