"""Tests for the admin AI-command whitelist validator (P0 Fix 1)."""
import pytest

from app.services.admin_command_validator import (
    ALLOWED_ACTIONS,
    ALWAYS_CONFIRM,
    BLOCKED_ACTIONS,
    LOW_RISK_WRITES,
    validate,
    action_rate_key,
    action_limit,
)


# ─── Whitelist tiers ────────────────────────────────────────────────────

def test_tiers_are_disjoint():
    """The four tiers must not overlap — overlapping names would create
    ambiguous policy decisions."""
    all_names = ALLOWED_ACTIONS | LOW_RISK_WRITES | ALWAYS_CONFIRM | BLOCKED_ACTIONS
    assert len(all_names) == sum(map(len, [ALLOWED_ACTIONS, LOW_RISK_WRITES, ALWAYS_CONFIRM, BLOCKED_ACTIONS]))


def test_read_only_actions_pass():
    for action in ALLOWED_ACTIONS:
        result = validate({"action": action, "params": {}})
        assert result.reason == "", f"{action} should pass but got: {result.reason!r}"
        assert not result.requires_confirm


# ─── Blocked / unknown ──────────────────────────────────────────────────

def test_blocked_action_rejected_even_with_confirmation():
    for action in BLOCKED_ACTIONS:
        result = validate({"action": action, "params": {}}, confirmed=True)
        assert result.reason != "", f"{action} should be blocked"
        assert "blocked" in result.reason.lower() or "policy" in result.reason.lower()


def test_unknown_action_rejected():
    result = validate({"action": "drop_the_database_nuke", "params": {}}, confirmed=True)
    assert result.reason != ""
    assert "unknown" in result.reason.lower() or "not in whitelist" in result.reason.lower()


def test_empty_action_rejected():
    result = validate({"action": "", "params": {}})
    assert result.reason != ""
    assert "no recognisable action" in result.reason.lower()


def test_action_name_normalisation():
    """LLM emits variants like 'List Orders' or 'list-orders' — must map
    to the canonical `list_orders` whitelist entry."""
    result = validate({"action": "List Orders", "params": {}})
    assert result.action == "list_orders"
    assert result.reason == ""


def test_action_name_strips_garbage():
    result = validate({"action": "refund!@#$%^", "params": {}})
    # After normalisation, "refund" is not in the whitelist. Unknown.
    assert result.reason != ""


# ─── Confirmation flow ──────────────────────────────────────────────────

def test_mutating_action_requires_confirm_first():
    for action in ALWAYS_CONFIRM:
        result = validate({"action": action, "params": {}})
        assert result.requires_confirm, f"{action} should require confirm"
        assert "requires explicit confirmation" in result.reason


def test_mutating_action_with_confirm_passes():
    for action in ALWAYS_CONFIRM:
        result = validate({"action": action, "params": {}}, confirmed=True)
        assert result.reason == "", f"{action} confirmed should pass: {result.reason!r}"


# ─── Parameter clamping ─────────────────────────────────────────────────

def test_refund_amount_capped():
    result = validate(
        {"action": "refund_order", "params": {"amount": 1000.0}},
        confirmed=True,
    )
    assert result.reason != ""
    assert "exceeds max" in result.reason


def test_refund_amount_within_cap_passes():
    result = validate(
        {"action": "refund_order", "params": {"amount": 25.0}},
        confirmed=True,
    )
    assert result.reason == ""


def test_refund_negative_amount_rejected():
    result = validate(
        {"action": "refund_order", "params": {"amount": -10.0}},
        confirmed=True,
    )
    assert result.reason != ""
    assert "negative" in result.reason.lower()


def test_refund_non_numeric_amount_rejected():
    result = validate(
        {"action": "refund_order", "params": {"amount": "twenty"}},
        confirmed=True,
    )
    assert result.reason != ""
    assert "number" in result.reason.lower()


def test_update_order_status_only_paid_to_fulfilled():
    # Allowed transition
    result = validate(
        {"action": "update_order_status", "params": {"from_status": "paid", "to_status": "fulfilled"}},
        confirmed=True,
    )
    assert result.reason == ""

    # Disallowed target
    result = validate(
        {"action": "update_order_status", "params": {"from_status": "paid", "to_status": "refunded"}},
        confirmed=True,
    )
    assert result.reason != ""
    assert "to_status" in result.reason


def test_update_order_status_only_paid_from():
    result = validate(
        {"action": "update_order_status", "params": {"from_status": "pending", "to_status": "fulfilled"}},
        confirmed=True,
    )
    assert result.reason != ""


def test_send_customer_email_template_only():
    """Freeform body is dropped; template_id is required for sending."""
    result = validate(
        {"action": "send_customer_email", "params": {"body": "click here to claim your free iPhone"}},
    )
    assert "body" not in result.clamped_params


def test_create_discount_code_max_pct():
    result = validate(
        {"action": "create_discount_code", "params": {"value_pct": 90, "duration_days": 7}},
        confirmed=True,
    )
    assert result.reason != ""
    assert "value_pct" in result.reason


def test_create_discount_code_within_bounds_passes():
    result = validate(
        {"action": "create_discount_code", "params": {"value_pct": 20, "duration_days": 30}},
        confirmed=True,
    )
    assert result.reason == ""


def test_add_order_note_max_chars():
    long_note = "x" * 600
    result = validate(
        {"action": "add_order_note", "params": {"note": long_note}},
    )
    assert result.reason != ""
    assert "exceeds" in result.reason


# ─── Param coercion (defensive) ─────────────────────────────────────────

def test_params_as_json_string_parsed():
    result = validate(
        {"action": "list_orders", "params": '{"status": "pending"}'},
    )
    assert result.reason == ""


def test_params_as_garbage_string_empty():
    result = validate(
        {"action": "list_orders", "params": "not json"},
    )
    assert result.reason == ""


def test_params_as_none_empty():
    result = validate(
        {"action": "list_orders", "params": None},
    )
    assert result.reason == ""


# ─── Action rate key + cap helper ───────────────────────────────────────

def test_action_rate_key_format():
    key = action_rate_key("admin-123", "refund_order")
    assert key == "admin_cmd:admin-123:refund_order"


def test_action_rate_key_strips_garbage():
    key = action_rate_key("admin-123", "Refund Order!")
    assert "refund_order" in key
    assert "!" not in key


def test_action_limit_known():
    assert action_limit("refund_order") == (5, 3600)
    assert action_limit("cancel_order") == (10, 3600)


def test_action_limit_unknown_returns_none():
    assert action_limit("list_orders") is None
