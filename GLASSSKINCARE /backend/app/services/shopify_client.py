"""Shopify Storefront API client."""
import httpx
from app.config import settings

STOREFRONT_API_VERSION = "2024-01"

async def verify_shopify_customer_token(customer_token: str) -> dict | None:
    """
    Verify a Shopify customer access token by querying the Storefront API.
    Returns {"customer_id": "gid://shopify/Customer/...", "email": "..."} or None.
    """
    storefront_token = getattr(settings, 'PUBLIC_STOREFRONT_API_TOKEN', '') or ''
    if not settings.SHOPIFY_STORE_DOMAIN or not storefront_token:
        return None

    query = """
    query GetCustomer($customerAccessToken: String!) {
      customer(customerAccessToken: $customerAccessToken) {
        id
        email
      }
    }
    """

    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(
                f"https://{settings.SHOPIFY_STORE_DOMAIN}/api/{STOREFRONT_API_VERSION}/graphql.json",
                json={"query": query, "variables": {"customerAccessToken": customer_token}},
                headers={
                    "X-Shopify-Storefront-Access-Token": storefront_token,
                    "Content-Type": "application/json",
                },
                timeout=10.0,
            )
            data = r.json()
            customer = data.get("data", {}).get("customer")
            if not customer:
                return None
            return {"customer_id": customer["id"], "email": customer["email"]}
        except Exception:
            return None
