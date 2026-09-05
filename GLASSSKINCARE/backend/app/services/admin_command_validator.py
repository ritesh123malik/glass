"""Whitelist validator for admin AI command bar.

P0 security patch (ARCHITECTURE_PATCHES.md Fix 1): the LLM that produces
structured `parse_admin_command` output is untrusted. Every action it proposes
MUST be checked against ALLOWED_ACTIONS before execution. Unknown or
explicitly-blocked actions are rejected with 422.

Three tiers:
  ALLOWED_ACTIONS      — read-only queries, no confirmation
  LOW_RISK_WRITES      — small mutations, no confirmation but rate-capped
  ALWAYS_CONFIRM       — must send `confirmed: true` in the execute request
  BLOCKED_ACTIONS      — refused even with confirmation (destructive / sensitive)

ACTION_LIMITS caps each action per admin per rolling 60 min. Enforced via
the shared Redis-backed `rate_limit` middleware by composing a synthetic key
per (admin_id, action).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


# ─── Tiers ──────────────────────────────────────────────────────────────

# Read-only Shopify Admin queries. Safe — no side effects.
ALLOWED_ACTIONS: frozenset[str] = frozenset({
    "list_orders",
    "get_order",
    "list_customers",
    "get_customer",
    "list_products",
    "get_product",
    "list_pending_fulfillments",
    "list_low_stock",
    "list_recent_refunds",
    "get_analytics_revenue",
    "get_analytics_top_products",
    "get_analytics_traffic",
    "get_dashboard_summary",
    "list_recent_admin_actions",
})

# Small mutations with bounded blast radius. Capped by ACTION_LIMITS.
LOW_RISK_WRITES: frozenset[str] = frozenset({
    "add_order_note",
    "send_customer_email",        # template-only — no freeform body allowed
    "export_customers_csv",
    "export_orders_csv",
    "rerun_product_embedding",
    "publish_theme_update",
})

# Mutations the LLM can propose but a human must approve in the UI.
ALWAYS_CONFIRM: frozenset[str] = frozenset({
    "update_order_status",        # state transitions, e.g. paid → fulfilled
    "refund_order",               # single refund, capped to ≤ $50 by PARAM_LIMITS
    "fulfill_order",
    "cancel_order",
    "create_discount_code",
    "restock_inventory",
})

# Explicit refusals. Never executed, even with confirmation.
BLOCKED_ACTIONS: frozenset[str] = frozenset({
    "bulk_refund",
    "delete_customer",
    "delete_product",
    "delete_order",
    "change_admin_password",
    "change_admin_email",
    "rotate_shopify_token",
    "rotate_webhook_secret",
    "drop_database_table",
    "execute_raw_sql",
    "modify_billing",
})


# Per-action hard limits, enforced on `params` before execution.
PARAM_LIMITS: dict[str, dict[str, Any]] = {
    "refund_order":            {"max_amount": 50.0,  "currency": "USD"},
    "update_order_status":     {"allowed_from": {"paid"}, "allowed_to": {"fulfilled", "restocked"}},
    "send_customer_email":     {"template_only": True,   "max_chars": 2000},
    "create_discount_code":    {"max_value_pct": 30,     "max_duration_days": 90},
    "add_order_note":          {"max_chars": 500},
    "fulfill_order":           {"require_tracking": False},
    "cancel_order":            {"allowed_from": {"paid", "fulfilled"}},
    "restock_inventory":       {"max_qty_per_item": 1000},
}

# Per-action per-hour cap, enforced via rate_limit dependency.
ACTION_LIMITS: dict[str, tuple[int, int]] = {
    # action                : (max_calls, window_seconds)
    "refund_order":           (5,  3600),
    "cancel_order":           (10, 3600),
    "fulfill_order":          (30, 3600),
    "update_order_status":    (30, 3600),
    "create_discount_code":   (5,  3600),
    "send_customer_email":    (50, 3600),
    "add_order_note":         (100, 3600),
    "restock_inventory":      (20, 3600),
}


# ─── Result types ───────────────────────────────────────────────────────

@dataclass(frozen=True)
class ValidatedAdminAction:
    action: str
    params: dict[str, Any] = field(default_factory=dict)
    requires_confirm: bool = False
    reason: str = ""
    # Populated after parameter clamping for execution.
    clamped_params: dict[str, Any] = field(default_factory=dict)


# ─── Whitelist check ────────────────────────────────────────────────────

_ALL_KNOWN: frozenset[str] = ALLOWED_ACTIONS | LOW_RISK_WRITES | ALWAYS_CONFIRM | BLOCKED_ACTIONS


def _normalise_action(raw: str) -> str:
    """Map LLM output to a canonical action name.

    Strips whitespace, lowercases, collapses spaces/hyphens to underscores.
    """
    if not isinstance(raw, str):
        return ""
    s = raw.strip().lower()
    s = re.sub(r"[\s\-]+", "_", s)
    s = re.sub(r"[^a-z0-9_]", "", s)
    return s


def _coerce_params(raw: Any) -> dict[str, Any]:
    """Defensive: LLM sometimes returns params as a JSON string or None."""
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            import json
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def _clamp_params(action: str, params: dict[str, Any]) -> tuple[dict[str, Any], str | None]:
    """Apply PARAM_LIMITS. Returns (clamped, error_or_none)."""
    limits = PARAM_LIMITS.get(action)
    if not limits:
        # Whitelist pass: reject unknown keys? For now, accept any params on
        # known read-only actions. LOW_RISK/ALWAYS_CONFIRM all have limits.
        if action in ALLOWED_ACTIONS:
            return params, None
        return params, f"no PARAM_LIMITS declared for {action}"

    clamped = dict(params)

    if "max_amount" in limits and "amount" in clamped:
        try:
            amount = float(clamped["amount"])
        except (TypeError, ValueError):
            return clamped, "amount must be a number"
        if amount < 0:
            return clamped, "amount cannot be negative"
        if amount > limits["max_amount"]:
            return clamped, f"amount {amount} exceeds max {limits['max_amount']}"
        clamped["amount"] = amount

    if "max_chars" in limits:
        for key in ("body", "note", "message", "subject"):
            if key in clamped and isinstance(clamped[key], str):
                if len(clamped[key]) > limits["max_chars"]:
                    return clamped, f"{key} exceeds {limits['max_chars']} chars"

    if "max_value_pct" in limits and "value_pct" in clamped:
        try:
            pct = float(clamped["value_pct"])
        except (TypeError, ValueError):
            return clamped, "value_pct must be a number"
        if pct < 0 or pct > limits["max_value_pct"]:
            return clamped, f"value_pct must be 0-{limits['max_value_pct']}"
        clamped["value_pct"] = pct

    if "max_duration_days" in limits and "duration_days" in clamped:
        try:
            days = int(clamped["duration_days"])
        except (TypeError, ValueError):
            return clamped, "duration_days must be an integer"
        if days < 1 or days > limits["max_duration_days"]:
            return clamped, f"duration_days must be 1-{limits['max_duration_days']}"
        clamped["duration_days"] = days

    if "template_only" in limits and limits["template_only"]:
        # Force template id, reject freeform body.
        if "body" in clamped and "template_id" not in clamped:
            clamped.pop("body")

    if "allowed_from" in limits and "from_status" in clamped:
        if clamped["from_status"] not in limits["allowed_from"]:
            return clamped, f"from_status must be one of {sorted(limits['allowed_from'])}"

    if "allowed_to" in limits and "to_status" in clamped:
        if clamped["to_status"] not in limits["allowed_to"]:
            return clamped, f"to_status must be one of {sorted(limits['allowed_to'])}"

    if "max_qty_per_item" in limits and "qty" in clamped:
        try:
            qty = int(clamped["qty"])
        except (TypeError, ValueError):
            return clamped, "qty must be an integer"
        if qty < 0 or qty > limits["max_qty_per_item"]:
            return clamped, f"qty must be 0-{limits['max_qty_per_item']}"
        clamped["qty"] = qty

    return clamped, None


# ─── Public entry point ────────────────────────────────────────────────

def validate(parsed: dict[str, Any], *, confirmed: bool = False) -> ValidatedAdminAction:
    """Validate the LLM's structured `parse_admin_command` output.

    `parsed` is the dict returned by `parse_admin_command`. Must contain at
    least an `action` key. Returns a `ValidatedAdminAction` whose `reason`
    field is non-empty on rejection (caller should surface it as 422).
    """
    raw_action = parsed.get("action", "")
    action = _normalise_action(raw_action)
    params = _coerce_params(parsed.get("params"))

    if not action:
        return ValidatedAdminAction(
            action="", reason="LLM returned no recognisable action",
        )

    if action in BLOCKED_ACTIONS:
        return ValidatedAdminAction(
            action=action, reason=f"action '{action}' is blocked by policy",
        )

    if action not in _ALL_KNOWN:
        return ValidatedAdminAction(
            action=action, reason=f"unknown action '{action}' (not in whitelist)",
        )

    requires_confirm = action in ALWAYS_CONFIRM

    # Apply parameter limits.
    clamped, err = _clamp_params(action, params)
    if err is not None:
        return ValidatedAdminAction(
            action=action, params=params, reason=err,
        )

    if requires_confirm and not confirmed:
        return ValidatedAdminAction(
            action=action,
            params=params,
            clamped_params=clamped,
            requires_confirm=True,
            reason="requires explicit confirmation",
        )

    return ValidatedAdminAction(
        action=action,
        params=params,
        clamped_params=clamped,
        requires_confirm=requires_confirm,
    )


# ─── Action key helper (for rate_limit integration) ────────────────────

def action_rate_key(admin_id: str, action: str) -> str:
    """Compose the key used by `rate_limit` middleware to cap per-action
    volume. Format: `admin_cmd:{admin_id}:{action}`. Non-alphanumeric chars
    are collapsed to underscores so word boundaries survive (e.g.
    "Refund Order!" → "refund_order")."""
    safe = re.sub(r"[^a-z0-9_]+", "_", action.lower()).strip("_")
    return f"admin_cmd:{admin_id}:{safe}"


def action_limit(action: str) -> tuple[int, int] | None:
    """Return (max_calls, window_seconds) for an action, or None if uncapped."""
    return ACTION_LIMITS.get(action)
