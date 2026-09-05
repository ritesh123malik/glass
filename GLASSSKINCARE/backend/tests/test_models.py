"""Tests for all AI backend models."""
import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.skin_profile import SkinProfile
from app.models.product_embedding import ProductEmbedding
from app.models.ai_conversation import AIConversation
from app.models.admin_action import AdminAction


@pytest.fixture
async def db() -> AsyncSession:
    """Provide a database session for tests."""
    async with AsyncSessionLocal() as session:
        yield session


async def make_user(db: AsyncSession, email: str | None = None) -> User:
    """Create a test user with a unique email."""
    user = User(
        email=email or f"test-{uuid.uuid4()}@example.com",
        is_admin=False,
    )
    db.add(user)
    await db.flush()
    return user


async def make_admin(db: AsyncSession) -> User:
    """Create a test admin user."""
    user = User(
        email=f"admin-{uuid.uuid4()}@example.com",
        is_admin=True,
        password_hash="fake_hash_for_admin",
    )
    db.add(user)
    await db.flush()
    return user


# -------------------------------------------------------------------
# SkinProfile tests
# -------------------------------------------------------------------

async def test_skin_profile_crud(db: AsyncSession):
    """SkinProfile: create, flush, load back, assert fields."""
    user = await make_user(db)
    sp = SkinProfile(
        user_id=user.id,
        skin_type="oily",
        concerns=["acne"],
        quiz_answers={"q1": "a"},
    )
    db.add(sp)
    await db.flush()

    loaded = await db.get(SkinProfile, sp.id)
    assert loaded is not None
    assert loaded.skin_type == "oily"
    assert loaded.concerns == ["acne"]
    assert loaded.quiz_answers == {"q1": "a"}
    assert loaded.user_id == user.id


async def test_skin_profile_optional_fields_null(db: AsyncSession):
    """SkinProfile: optional fields may be null."""
    user = await make_user(db)
    sp = SkinProfile(user_id=user.id)
    db.add(sp)
    await db.flush()

    loaded = await db.get(SkinProfile, sp.id)
    assert loaded.skin_type is None
    assert loaded.concerns is None
    assert loaded.quiz_answers is None
    assert loaded.photo_analysis is None


async def test_skin_profile_photo_analysis(db: AsyncSession):
    """SkinProfile: photo_analysis JSONB field."""
    user = await make_user(db)
    sp = SkinProfile(
        user_id=user.id,
        skin_type="dry",
        photo_analysis={"score": 0.8, "issues": ["redness"]},
    )
    db.add(sp)
    await db.flush()

    loaded = await db.get(SkinProfile, sp.id)
    assert loaded.photo_analysis["score"] == 0.8
    assert "redness" in loaded.photo_analysis["issues"]


# -------------------------------------------------------------------
# ProductEmbedding tests
# -------------------------------------------------------------------

async def test_product_embedding_crud(db: AsyncSession):
    """ProductEmbedding: create, flush, load back, assert fields."""
    pe = ProductEmbedding(
        shopify_product_id="gid://shopify/Product/1",
        shopify_handle="vitamin-c",
        product_name="Vitamin C Serum",
        skin_types=["oily"],
        concerns=["brightening"],
        benefit_embedding=[0.1] * 384,
    )
    db.add(pe)
    await db.flush()

    loaded = await db.get(ProductEmbedding, pe.id)
    assert loaded is not None
    assert loaded.shopify_product_id == "gid://shopify/Product/1"
    assert loaded.shopify_handle == "vitamin-c"
    assert loaded.product_name == "Vitamin C Serum"
    assert loaded.skin_types == ["oily"]
    assert loaded.concerns == ["brightening"]
    assert len(loaded.benefit_embedding) == 384


async def test_product_embedding_unique_shopify_product_id(db: AsyncSession):
    """ProductEmbedding: shopify_product_id must be unique."""
    pe1 = ProductEmbedding(
        shopify_product_id="gid://shopify/Product/2",
        shopify_handle="retinol",
        product_name="Retinol Serum",
    )
    db.add(pe1)
    await db.flush()

    pe2 = ProductEmbedding(
        shopify_product_id="gid://shopify/Product/2",  # same ID
        shopify_handle="niacinamide",
        product_name="Niacinamide Serum",
    )
    db.add(pe2)
    with pytest.raises(Exception):  # unique constraint violation
        await db.flush()
    await db.rollback()


async def test_product_embedding_optional_fields_null(db: AsyncSession):
    """ProductEmbedding: optional fields may be null."""
    pe = ProductEmbedding(
        shopify_product_id="gid://shopify/Product/3",
        shopify_handle="basic",
        product_name="Basic Moisturiser",
    )
    db.add(pe)
    await db.flush()

    loaded = await db.get(ProductEmbedding, pe.id)
    assert loaded.skin_types is None
    assert loaded.concerns is None
    assert loaded.ingredients_summary is None
    assert loaded.benefit_embedding is None


# -------------------------------------------------------------------
# AIConversation tests
# -------------------------------------------------------------------

async def test_ai_conversation_crud(db: AsyncSession):
    """AIConversation: create, flush, load back, assert fields."""
    conv = AIConversation(
        session_id="sess_123",
        messages=[{"role": "user", "content": "hi"}],
    )
    db.add(conv)
    await db.flush()

    loaded = await db.get(AIConversation, conv.id)
    assert loaded is not None
    assert loaded.session_id == "sess_123"
    assert loaded.messages[0]["content"] == "hi"
    assert loaded.converted is False
    assert loaded.user_id is None


async def test_ai_conversation_with_user(db: AsyncSession):
    """AIConversation: can link to a user."""
    user = await make_user(db)
    conv = AIConversation(
        user_id=user.id,
        session_id="sess_456",
        messages=[{"role": "assistant", "content": "hello"}],
        skin_analysis={"skin_type": "oily"},
        recommendations={"handles": ["vitamin-c"]},
        converted=True,
    )
    db.add(conv)
    await db.flush()

    loaded = await db.get(AIConversation, conv.id)
    assert loaded.user_id == user.id
    assert loaded.skin_analysis["skin_type"] == "oily"
    assert loaded.recommendations["handles"] == ["vitamin-c"]
    assert loaded.converted is True


async def test_ai_conversation_messages_default_empty_list(db: AsyncSession):
    """AIConversation: messages defaults to empty list."""
    conv = AIConversation(session_id="sess_789")
    db.add(conv)
    await db.flush()

    loaded = await db.get(AIConversation, conv.id)
    assert loaded.messages == []


# -------------------------------------------------------------------
# AdminAction tests
# -------------------------------------------------------------------

async def test_admin_action_crud(db: AsyncSession):
    """AdminAction: create, flush, load back, assert fields."""
    admin_user = await make_admin(db)
    action = AdminAction(
        admin_id=admin_user.id,
        action="order.refund",
        command="refund order 1042",
    )
    db.add(action)
    await db.flush()

    loaded = await db.get(AdminAction, action.id)
    assert loaded is not None
    assert loaded.action == "order.refund"
    assert loaded.admin_id == admin_user.id
    assert loaded.command == "refund order 1042"


async def test_admin_action_all_fields(db: AsyncSession):
    """AdminAction: set all fields including target and details."""
    admin_user = await make_admin(db)
    action = AdminAction(
        admin_id=admin_user.id,
        action="order.status_update",
        target_type="shopify_order",
        target_id="gid://shopify/Order/999",
        command="update order status to fulfilled",
        details={"old_status": "pending", "new_status": "fulfilled"},
    )
    db.add(action)
    await db.flush()

    loaded = await db.get(AdminAction, action.id)
    assert loaded.target_type == "shopify_order"
    assert loaded.target_id == "gid://shopify/Order/999"
    assert loaded.details["new_status"] == "fulfilled"


async def test_admin_action_optional_fields_null(db: AsyncSession):
    """AdminAction: optional fields may be null."""
    admin_user = await make_admin(db)
    action = AdminAction(
        admin_id=admin_user.id,
        action="product.create",
    )
    db.add(action)
    await db.flush()

    loaded = await db.get(AdminAction, action.id)
    assert loaded.target_type is None
    assert loaded.target_id is None
    assert loaded.command is None
    assert loaded.details is None
