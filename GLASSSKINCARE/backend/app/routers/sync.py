"""Shopify webhook synchronization router."""
import json
from fastapi import APIRouter, Depends, Request, BackgroundTasks
from app.dependencies.shopify import verify_shopify_hmac
from app.middleware.rate_limit import rate_limit
from app.services.sync_service import sync_single_product, process_order_paid

router = APIRouter(prefix="/sync", tags=["sync"])

@router.post("/product-updated", status_code=200)
async def product_updated(
    request: Request,
    background_tasks: BackgroundTasks,
    body: bytes = Depends(verify_shopify_hmac),
):
    """Handle Shopify products/create and products/update webhooks."""
    await rate_limit(request, max_calls=120, window_seconds=60)
    payload = json.loads(body)
    product_id = payload.get("admin_graphql_api_id") or payload.get("id")
    if product_id:
        product_gid = str(product_id)
        if not product_gid.startswith("gid://"):
            product_gid = f"gid://shopify/Product/{product_id}"
        background_tasks.add_task(sync_single_product, product_gid)
    return {"status": "ok"}

@router.post("/order-paid", status_code=200)
async def order_paid(
    request: Request,
    background_tasks: BackgroundTasks,
    body: bytes = Depends(verify_shopify_hmac),
):
    """Handle Shopify orders/paid webhooks."""
    await rate_limit(request, max_calls=120, window_seconds=60)
    payload = json.loads(body)
    email = (payload.get("customer") or {}).get("email", "")
    order_id = payload.get("admin_graphql_api_id") or payload.get("id", "")
    if email:
        order_gid = str(order_id)
        if not order_gid.startswith("gid://"):
            order_gid = f"gid://shopify/Order/{order_id}"
        background_tasks.add_task(process_order_paid, email, order_gid)
    return {"status": "ok"}
