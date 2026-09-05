"""JWT creation and verification.

P2 Fix 8: every token carries a `ver` claim matching the user's
`token_version`. On password change we bump `token_version`, which
invalidates every previously-issued token for that user. The check lives
in `get_current_admin` / `get_current_user`, which now load the user
from the DB and compare the claim against the live column.
"""
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID
from fastapi import Depends, Request, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import jwt
from app.config import settings
from app.database import get_db
from app.models.user import User


def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None,
    *,
    token_version: int = 1,
) -> str:
    """Encode a JWT. `token_version` is embedded as the `ver` claim so
    password changes can invalidate the token family server-side."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=settings.ACCESS_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire, "ver": token_version})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


async def _load_user_for_token(
    payload: dict[str, Any], db: AsyncSession
) -> User:
    """Look up the user referenced by a token's `sub` claim, verify the
    `ver` claim matches the live `token_version`. Raises 401 on mismatch
    or missing user. Treats the absence of a `ver` claim as version 1
    (pre-Fix 8 tokens) — they will succeed against a user whose
    `token_version` is still 1 and fail once it has been bumped.
    """
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token missing sub claim")
    try:
        user_id = UUID(sub)
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Token sub is not a UUID")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    token_ver = int(payload.get("ver", 1))
    if token_ver != user.token_version:
        raise HTTPException(status_code=401, detail="Token has been invalidated")
    return user


async def get_current_admin(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Decode Authorization: Bearer header, verify is_admin=True and
    that the token's `ver` claim matches the user's live token_version."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = auth[7:]
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not payload.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin required")
    user = await _load_user_for_token(payload, db)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access revoked")
    return payload


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Decode Authorization: Bearer header, verify `ver` claim, return
    the User row. Used for /auth/change-password and any future
    authenticated consumer route."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = auth[7:]
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return await _load_user_for_token(payload, db)
