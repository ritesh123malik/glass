"""Admin + Shopify auth routes."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    AdminLoginRequest,
    ChangePasswordRequest,
    ShopifyVerifyRequest,
    TokenResponse,
    UserResponse,
)
from app.services.jwt_service import create_access_token, get_current_user
from app.services.password_service import hash_password, verify_password
from app.services.shopify_client import verify_shopify_customer_token
from app.middleware.rate_limit import rate_limit


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/admin-login", response_model=TokenResponse)
async def admin_login(
    request: Request,
    payload: AdminLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify admin credentials and issue a JWT carrying the current
    `token_version`. Subsequent /auth/change-password bumps the version
    so this token is invalidated automatically."""
    await rate_limit(request, max_calls=5, window_seconds=60)

    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    token = create_access_token(
        {"sub": str(user.id), "is_admin": True},
        token_version=user.token_version,
    )
    return TokenResponse(access_token=token)


@router.post("/change-password", response_model=TokenResponse)
async def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the authenticated user's password and invalidate every
    other session by bumping `token_version`. Returns a fresh JWT for
    the current session so the caller is not locked out."""
    if len(payload.new_password) < 12:
        raise HTTPException(status_code=422, detail="new_password must be at least 12 characters")

    if not user.password_hash or not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    user.password_hash = hash_password(payload.new_password)
    user.token_version = user.token_version + 1
    await db.commit()
    await db.refresh(user)

    # Issue a new token reflecting the bumped version. The caller
    # should replace their stored cookie/JWT with this value.
    token = create_access_token(
        {"sub": str(user.id), "is_admin": user.is_admin},
        token_version=user.token_version,
    )
    return TokenResponse(access_token=token)


@router.post("/verify-shopify-token", response_model=UserResponse)
async def verify_shopify_token(
    payload: ShopifyVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify a Shopify customer access token, upsert the corresponding user,
    and return their internal id + skin profile status.

    Looks up by shopify_customer_id first, then by email (to link pre-existing
    rows), creating a new user only when neither match exists.
    """
    shopify_info = await verify_shopify_customer_token(payload.shopify_customer_token)
    if not shopify_info:
        raise HTTPException(status_code=401, detail="Invalid Shopify customer token")

    customer_id = shopify_info["customer_id"]
    email = shopify_info["email"]

    # 1. Match by Shopify customer id (primary key)
    result = await db.execute(
        select(User).options(selectinload(User.skin_profile)).where(User.shopify_customer_id == customer_id)
    )
    user = result.scalar_one_or_none()

    # 2. Fallback: link by email to avoid duplicate rows
    if user is None:
        result = await db.execute(
            select(User).options(selectinload(User.skin_profile)).where(User.email == email)
        )
        user = result.scalar_one_or_none()
        if user is not None:
            user.shopify_customer_id = customer_id
        else:
            # 3. Create new user (consumer, not admin)
            user = User(email=email, shopify_customer_id=customer_id, is_admin=False)
            db.add(user)

        await db.commit()
        await db.refresh(user, attribute_names=["skin_profile"])

    has_profile = user.skin_profile is not None
    skin_type = user.skin_profile.skin_type if user.skin_profile else None

    return UserResponse(
        id=str(user.id),
        email=user.email,
        has_skin_profile=has_profile,
        skin_type=skin_type,
    )