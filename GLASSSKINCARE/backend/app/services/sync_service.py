"""Shopify product sync service."""
import httpx
from sqlalchemy import select
from app.config import settings
from app.database import AsyncSessionLocal
from app.models.product_embedding import ProductEmbedding
from app.services.embedding_service import generate_embedding

PRODUCTS_QUERY = """
query GetProduct($id: ID!) {
  product(id: $id) {
    id
    handle
    title
    description
    metafields(identifiers: [
      { namespace: "skincare", key: "skin_types" }
      { namespace: "skincare", key: "concerns" }
      { namespace: "skincare", key: "ingredients" }
    ]) {
      key
      value
    }
  }
}
"""

async def sync_single_product(product_gid: str) -> None:
    """Fetch product from Shopify, embed, and upsert."""
    if not settings.SHOPIFY_STORE_DOMAIN or not settings.SHOPIFY_ADMIN_API_TOKEN:
        return

    if not product_gid.startswith("gid://"):
        product_gid = f"gid://shopify/Product/{product_gid}"

    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"https://{settings.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/graphql.json",
            json={"query": PRODUCTS_QUERY, "variables": {"id": product_gid}},
            headers={
                "X-Shopify-Access-Token": settings.SHOPIFY_ADMIN_API_TOKEN,
                "Content-Type": "application/json",
            },
            timeout=10.0,
        )
        data = r.json()
        product = data.get("data", {}).get("product")

    if not product:
        return

    skin_types = []
    concerns = []
    ingredients = ""

    for mf in (product.get("metafields") or []):
        if not mf:
            continue
        key = mf.get("key")
        value = mf.get("value", "")
        if key == "skin_types":
            import json
            skin_types = json.loads(value) if value else []
        elif key == "concerns":
            import json
            concerns = json.loads(value) if value else []
        elif key == "ingredients":
            ingredients = value or ""

    embedding_text = " ".join([
        product["title"],
        product.get("description", ""),
        ", ".join(skin_types),
        ", ".join(concerns),
        ingredients,
    ])

    embedding = generate_embedding(embedding_text)

    product_data = {
        "shopify_product_id": product["id"],
        "shopify_handle": product["handle"],
        "product_name": product["title"],
        "skin_types": skin_types,
        "concerns": concerns,
        "ingredients_summary": ingredients,
        "benefit_embedding": embedding,
    }

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ProductEmbedding).where(
                ProductEmbedding.shopify_product_id == product["id"]
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            for key, val in product_data.items():
                setattr(existing, key, val)
        else:
            db.add(ProductEmbedding(**product_data))
        
        await db.commit()

async def process_order_paid(customer_email: str, order_id: str) -> None:
    """Process an order paid webhook."""
    # Placeholder: fetch User, check skin_profile, trigger AI followup
    pass
