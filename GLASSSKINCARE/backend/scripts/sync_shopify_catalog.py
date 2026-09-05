"""
Sync Glass Skincare product catalog from Shopify Admin API to product_embeddings table.

Usage:
    python scripts/sync_shopify_catalog.py [--dry-run]
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import httpx
from app.config import settings
from app.services.sync_service import sync_single_product

PRODUCTS_QUERY = """
query {
  products(first: 250) {
    edges {
      node {
        id
      }
    }
  }
}
"""

async def sync(dry_run: bool = False) -> None:
    if not settings.SHOPIFY_STORE_DOMAIN or not settings.SHOPIFY_ADMIN_API_TOKEN:
        print("ERROR: SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_API_TOKEN must be set in .env")
        sys.exit(1)

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://{settings.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/graphql.json",
            json={"query": PRODUCTS_QUERY},
            headers={
                "X-Shopify-Access-Token": settings.SHOPIFY_ADMIN_API_TOKEN,
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        products = response.json()["data"]["products"]["edges"]

    count = 0
    for edge in products:
        product_id = edge["node"]["id"]
        if dry_run:
            print(f"[DRY RUN] Would sync: {product_id}")
            count += 1
            continue
        
        await sync_single_product(product_id)
        count += 1

    print(f"Synced {count} products. (dry_run={dry_run})")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(sync(dry_run=args.dry_run))
