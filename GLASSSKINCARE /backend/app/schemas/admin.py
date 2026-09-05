"""Admin endpoint request/response schemas."""
from pydantic import BaseModel


class ParseCommandRequest(BaseModel):
    command: str


class ParseCommandResponse(BaseModel):
    action: str
    description: str
    requires_confirmation: bool
    params: dict
    estimated_impact: str | None = None
    # Whitelist-validator output (P0 Fix 1). `validated: true` means the
    # action passed the whitelist AND parameter limits; `requires_confirm`
    # reflects both LLM and validator output.
    validated: bool = True
    reason: str | None = None
    clamped_params: dict | None = None


class ExecuteCommandRequest(BaseModel):
    action: str
    params: dict
    confirmed: bool = False


class ExecuteCommandResponse(BaseModel):
    status: str                          # "executed" | "requires_confirm" | "rejected"
    action: str
    result: dict | None = None           # populated when executed
    reason: str | None = None            # populated when rejected/confirm-needed
    requires_confirm: bool = False


class DashboardResponse(BaseModel):
    total_users: int
    conversations_last_7d: int
    low_stock_products: list[dict]


class OrderLineItem(BaseModel):
    id: str
    title: str
    quantity: int
    price: str


class Order(BaseModel):
    id: str
    name: str  # e.g. "#1042"
    created_at: str
    financial_status: str
    fulfillment_status: str | None
    total_price: str
    line_items: list[OrderLineItem]


class OrderListResponse(BaseModel):
    orders: list[Order]


# ─── Theme settings ────────────────────────────────────────────────────────

class ThemeTokens(BaseModel):
    """Palette tokens keyed by semantic name (e.g. 'cream', 'accent')."""
    model_config = {"extra": "allow"}
    tokens: dict[str, str]


class ThemeResponse(BaseModel):
    name: str
    tokens: dict[str, str]
    updated_at: str


class ThemeUpdate(BaseModel):
    """Full token replacement. Send the complete tokens dict."""
    tokens: dict[str, str]
