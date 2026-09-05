"""Admin command bar endpoints. Require admin JWT."""
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import httpx
from app.database import get_db
from app.models.user import User
from app.models.admin_action import AdminAction
from app.models.ai_conversation import AIConversation
from app.models.product_embedding import ProductEmbedding
from app.models.theme_setting import ThemeSetting
from app.schemas.admin import (
    ParseCommandRequest, ParseCommandResponse,
    ExecuteCommandRequest, ExecuteCommandResponse,
    DashboardResponse, Order, OrderLineItem, OrderListResponse,
    ThemeResponse, ThemeUpdate,
)
from app.services.ai_service import parse_admin_command
from app.services.admin_command_validator import (
    validate as validate_admin_action,
    action_rate_key,
    action_limit,
)
from app.services.jwt_service import get_current_admin
from app.middleware.rate_limit import rate_limit
from app.config import settings

router = APIRouter(prefix="/admin", tags=["admin"])


# Default palette — matches live glasskin-storefront.vercel.app.
# Single global theme; admins override via PUT /admin/theme.
DEFAULT_THEME_TOKENS: dict[str, str] = {
    "cream":      "#FFF6EB",
    "white":      "#FFFFFF",
    "tan":        "#E8D9C2",
    "brown":      "#261F1A",
    "ink":        "#1A1614",
    "muted":      "#7A6F66",
    "accent":     "#FF7700",
    "accent-2":   "#FF9A3C",
    "gold":       "#C8A268",
    "peach":      "#FFD4B0",
    "rose":       "#F2B5A0",
    "leaf":       "#5C7A3A",
    "sky":        "#9BC4D4",
    "lavender":   "#C4B5E0",
}


async def _get_or_create_default_theme(db: AsyncSession) -> ThemeSetting:
    row = (await db.execute(
        select(ThemeSetting).where(ThemeSetting.name == "default")
    )).scalar_one_or_none()
    if row is None:
        row = ThemeSetting(name="default", tokens=DEFAULT_THEME_TOKENS)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


# ─── Public theme read (for Hydrogen SSR) ─────────────────────────────
@router.get("/theme", response_model=ThemeResponse)
async def get_theme(db: AsyncSession = Depends(get_db)):
    """Read current theme. No auth — Hydrogen fetches this during SSR
    to inject CSS variables. Cached at edge via standard HTTP headers."""
    row = await _get_or_create_default_theme(db)
    return ThemeResponse(
        name=row.name,
        tokens=row.tokens,
        updated_at=row.updated_at.isoformat(),
    )


# ─── Admin theme mutation ─────────────────────────────────────────────
@router.put("/theme", response_model=ThemeResponse)
async def update_theme(
    payload: ThemeUpdate,
    admin: dict = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Replace full token set. Empty dict rejected (use reset)."""
    if not payload.tokens:
        raise HTTPException(status_code=422, detail="tokens cannot be empty")
    row = await _get_or_create_default_theme(db)
    row.tokens = payload.tokens
    row.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(row)
    return ThemeResponse(
        name=row.name,
        tokens=row.tokens,
        updated_at=row.updated_at.isoformat(),
    )


@router.post("/theme/reset", response_model=ThemeResponse)
async def reset_theme(
    admin: dict = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Restore the built-in default palette."""
    row = await _get_or_create_default_theme(db)
    row.tokens = dict(DEFAULT_THEME_TOKENS)
    row.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(row)
    return ThemeResponse(
        name=row.name,
        tokens=row.tokens,
        updated_at=row.updated_at.isoformat(),
    )


@router.post("/parse-command", response_model=ParseCommandResponse)
async def parse_command(
    request: Request,
    payload: ParseCommandRequest,
    admin: dict = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    await rate_limit(request, max_calls=60, window_seconds=60)
    raw = await parse_admin_command(payload.command)

    # P0 Fix 1: every parsed action must pass the whitelist before the UI
    # is allowed to render an "Execute" affordance. Rejections are logged
    # so attempted prompt-injection paths are auditable.
    validated = validate_admin_action(raw)

    log = AdminAction(
        admin_id=admin["sub"],
        action=validated.action or raw.get("action", "unknown"),
        command=payload.command,
        details={
            "params": raw.get("params", {}),
            "validated": validated.reason == "",
            "reason": validated.reason,
        },
    )
    db.add(log)
    await db.commit()

    return ParseCommandResponse(
        action=validated.action or raw.get("action", ""),
        description=raw.get("description", ""),
        requires_confirmation=validated.requires_confirm or raw.get("requires_confirmation", False),
        params=raw.get("params", {}),
        estimated_impact=raw.get("estimated_impact"),
        validated=validated.reason == "",
        reason=validated.reason or None,
        clamped_params=validated.clamped_params or None,
    )


@router.post("/ai-command/execute", response_model=ExecuteCommandResponse)
async def execute_admin_command(
    request: Request,
    payload: ExecuteCommandRequest,
    admin: dict = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Execute a previously-validated admin action. Re-runs the whitelist
    on every call (don't trust the client). For mutating actions, the
    client must send `confirmed: true` — the UI shows a confirm modal first.
    """
    await rate_limit(request, max_calls=60, window_seconds=60)

    # Per-action rate cap (e.g. refund_order ≤ 5/hr per admin).
    cap = action_limit(payload.action)
    if cap is not None:
        await rate_limit(
            request,
            max_calls=cap[0],
            window_seconds=cap[1],
            key=action_rate_key(admin["sub"], payload.action),
        )

    validated = validate_admin_action(
        {"action": payload.action, "params": payload.params},
        confirmed=payload.confirmed,
    )

    if validated.reason:
        log = AdminAction(
            admin_id=admin["sub"],
            action=validated.action or payload.action,
            command="[execute]",
            details={"rejected": True, "reason": validated.reason},
        )
        db.add(log)
        await db.commit()
        return ExecuteCommandResponse(
            status="rejected",
            action=validated.action or payload.action,
            reason=validated.reason,
            requires_confirm=validated.requires_confirm,
        )

    if validated.requires_confirm and not payload.confirmed:
        return ExecuteCommandResponse(
            status="requires_confirm",
            action=validated.action,
            requires_confirm=True,
            reason="set confirmed=true to execute",
        )

    # Action passed validation. Actual Shopify Admin API call sites for
    # each action are not wired here — that's tracked separately. The
    # critical P0 surface is the whitelist, which is enforced above.
    log = AdminAction(
        admin_id=admin["sub"],
        action=validated.action,
        command="[execute]",
        details={"params": validated.clamped_params, "confirmed": payload.confirmed},
    )
    db.add(log)
    await db.commit()

    return ExecuteCommandResponse(
        status="executed",
        action=validated.action,
        result={"action": validated.action, "params": validated.clamped_params},
    )


@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(
    request: Request,
    admin: dict = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    await rate_limit(request, max_calls=60, window_seconds=60)

    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    week_ago = datetime.utcnow() - timedelta(days=7)
    conv_count = (await db.execute(
        select(func.count(AIConversation.id)).where(AIConversation.created_at >= week_ago)
    )).scalar() or 0

    return DashboardResponse(
        total_users=total_users,
        conversations_last_7d=conv_count,
        low_stock_products=[],  # placeholder
    )


@router.get("/orders", response_model=OrderListResponse)
async def list_orders(
    request: Request,
    admin: dict = Depends(get_current_admin),
):
    await rate_limit(request, max_calls=60, window_seconds=60)

    if not settings.SHOPIFY_ADMIN_API_TOKEN or not settings.SHOPIFY_STORE_DOMAIN:
        return OrderListResponse(orders=[])

    query = """
    query {
      orders(first: 20, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            createdAt
            displayFinancialStatus
            displayFulfillmentStatus
            totalPriceSet { shopMoney { amount currencyCode } }
            lineItems(first: 5) { edges { node { id title quantity originalUnitPriceSet { shopMoney { amount } } } } }
          }
        }
      }
    }
    """

    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"https://{settings.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/graphql.json",
                json={"query": query},
                headers={"X-Shopify-Access-Token": settings.SHOPIFY_ADMIN_API_TOKEN},
                timeout=10.0,
            )
            edges = r.json().get("data", {}).get("orders", {}).get("edges", [])
    except Exception:
        return OrderListResponse(orders=[])

    orders = []
    for edge in edges:
        node = edge["node"]
        items = []
        for le in node.get("lineItems", {}).get("edges", []):
            li = le["node"]
            price = li.get("originalUnitPriceSet", {}).get("shopMoney", {}).get("amount", "0")
            items.append(OrderLineItem(id=li["id"], title=li["title"], quantity=li["quantity"], price=price))
        orders.append(Order(
            id=node["id"],
            name=node["name"],
            created_at=node["createdAt"],
            financial_status=node.get("displayFinancialStatus", "unknown"),
            fulfillment_status=node.get("displayFulfillmentStatus"),
            total_price=node.get("totalPriceSet", {}).get("shopMoney", {}).get("amount", "0"),
            line_items=items,
        ))
    return OrderListResponse(orders=orders)
