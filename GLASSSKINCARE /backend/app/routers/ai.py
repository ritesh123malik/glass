"""AI endpoints: chat, quiz, photo analysis, recommendations."""
import secrets
import hmac
import hashlib
import json
from datetime import datetime, timedelta
from typing import AsyncIterator
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pgvector.sqlalchemy import Vector
from app.database import get_db
from app.models.user import User
from app.models.skin_profile import SkinProfile
from app.models.product_embedding import ProductEmbedding
from app.models.ai_conversation import AIConversation
from app.schemas.ai import (
    ChatRequest,
    SessionTokenResponse,
    SkinQuizRequest,
    SkinQuizResponse,
    AnalyzeSkinRequest,
    AnalyzeSkinResponse,
    RecommendRequest,
    RecommendResponse,
)
from app.services.ai_service import (
    get_dermatologist_response_stream,
    analyze_skin_photo,
    build_skin_routine,
)
from app.services.embedding_service import generate_embedding
from app.services.shopify_client import verify_shopify_customer_token
from app.middleware.rate_limit import rate_limit, get_redis
from app.config import settings

router = APIRouter(prefix="/ai", tags=["ai"])


# ─── Session token (anonymous challenge) ──────────────────────────────────

@router.get("/session-token", response_model=SessionTokenResponse)
async def session_token():
    """Generate a signed challenge token. 15-min TTL, stored in Redis."""
    raw = secrets.token_urlsafe(32)
    sig = hmac.new(
        settings.AI_CHALLENGE_SECRET.encode(), raw.encode(), hashlib.sha256
    ).hexdigest()[:32]
    token = f"{raw}.{sig}"
    try:
        r = await get_redis()
        await r.setex(f"ai_session:{raw}", 900, "1")
    except Exception:
        pass  # Redis optional in dev
    return SessionTokenResponse(token=token, expires_in=900)


async def _verify_session_token(token: str) -> bool:
    """Verify HMAC signature + Redis existence."""
    try:
        raw, sig = token.rsplit(".", 1)
        expected = hmac.new(
            settings.AI_CHALLENGE_SECRET.encode(), raw.encode(), hashlib.sha256
        ).hexdigest()[:32]
        if not hmac.compare_digest(sig, expected):
            return False
        r = await get_redis()
        return await r.exists(f"ai_session:{raw}") == 1
    except Exception:
        return False


# ─── Chat (streaming SSE) ─────────────────────────────────────────────────

@router.post("/chat")
async def chat(
    request: Request,
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    await rate_limit(request, max_calls=20, window_seconds=60)

    user = None
    if payload.shopify_customer_token:
        info = await verify_shopify_customer_token(payload.shopify_customer_token)
        if info:
            result = await db.execute(
                select(User).where(User.shopify_customer_id == info["customer_id"])
            )
            user = result.scalar_one_or_none()
    else:
        # Anonymous: verify session token from header
        token = request.headers.get("X-AI-Session-Token", "")
        if not token or not await _verify_session_token(token):
            raise HTTPException(status_code=401, detail="Invalid or missing session token")

    messages_dict = [{"role": m.role, "content": m.content} for m in payload.messages]
    product_catalog = ""  # TODO: load from product_embeddings table

    async def event_stream():
        async for chunk in get_dermatologist_response_stream(messages_dict, product_catalog):
            yield f"data: {json.dumps({'text': chunk})}\n\n"
        yield "data: [DONE]\n\n"

        # Persist conversation if user identified
        if user:
            conv = AIConversation(user_id=user.id, messages=messages_dict)
            db.add(conv)
            await db.commit()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ─── Skin quiz ────────────────────────────────────────────────────────────

@router.post("/skin-quiz", response_model=SkinQuizResponse)
async def skin_quiz(
    request: Request,
    payload: SkinQuizRequest,
    db: AsyncSession = Depends(get_db),
):
    await rate_limit(request, max_calls=10, window_seconds=60)

    answers = payload.answers.model_dump()
    product_catalog = ""  # TODO
    routine = await build_skin_routine(answers, product_catalog)

    if payload.shopify_customer_token:
        info = await verify_shopify_customer_token(payload.shopify_customer_token)
        if info:
            result = await db.execute(
                select(User).where(User.shopify_customer_id == info["customer_id"])
            )
            user = result.scalar_one_or_none()
            if user:
                # Upsert skin_profile
                sp_result = await db.execute(
                    select(SkinProfile).where(SkinProfile.user_id == user.id)
                )
                sp = sp_result.scalar_one_or_none()
                if not sp:
                    sp = SkinProfile(user_id=user.id)
                    db.add(sp)
                sp.skin_type = answers.get("skin_type")
                sp.concerns = [answers.get("primary_concern")] if answers.get("primary_concern") else None
                sp.quiz_answers = answers

                # Generate embedding from summary
                summary = routine.get("skin_profile_summary", "")
                if summary:
                    user.skin_embedding = generate_embedding(summary)

                await db.commit()

    return SkinQuizResponse(**routine)


# ─── Photo analysis ───────────────────────────────────────────────────────

@router.post("/analyze-skin", response_model=AnalyzeSkinResponse)
async def analyze_skin(
    request: Request,
    payload: AnalyzeSkinRequest,
    db: AsyncSession = Depends(get_db),
):
    await rate_limit(request, max_calls=5, window_seconds=60)

    analysis = await analyze_skin_photo(payload.image_base64, payload.media_type)

    user = None
    if payload.shopify_customer_token:
        info = await verify_shopify_customer_token(payload.shopify_customer_token)
        if info:
            result = await db.execute(
                select(User).where(User.shopify_customer_id == info["customer_id"])
            )
            user = result.scalar_one_or_none()
            if user:
                sp_result = await db.execute(
                    select(SkinProfile).where(SkinProfile.user_id == user.id)
                )
                sp = sp_result.scalar_one_or_none()
                if not sp:
                    sp = SkinProfile(user_id=user.id)
                    db.add(sp)
                sp.photo_analysis = analysis
                sp.skin_type = analysis.get("skin_type", sp.skin_type)
                sp.concerns = analysis.get("concerns", sp.concerns)

                # Generate embedding from analysis text
                analysis_text = f"{analysis.get('skin_type', '')} {' '.join(analysis.get('concerns', []))}"
                user.skin_embedding = generate_embedding(analysis_text)
                await db.commit()

    # TODO: implement handle mapping from analysis.concerns → product handles
    recommended: list[str] = []
    return AnalyzeSkinResponse(analysis=analysis, recommended_handles=recommended)


# ─── Recommend (pgvector cosine search) ──────────────────────────────────

@router.post("/recommend", response_model=RecommendResponse)
async def recommend(
    request: Request,
    payload: RecommendRequest,
    db: AsyncSession = Depends(get_db),
):
    await rate_limit(request, max_calls=20, window_seconds=60)

    info = await verify_shopify_customer_token(payload.shopify_customer_token)
    if not info:
        raise HTTPException(status_code=401, detail="Invalid Shopify customer token")

    result = await db.execute(
        select(User).where(User.shopify_customer_id == info["customer_id"])
    )
    user = result.scalar_one_or_none()
    if not user or not user.skin_embedding:
        # Fallback: top 5 random handles
        result = await db.execute(
            select(ProductEmbedding.shopify_handle).limit(5)
        )
        handles = result.scalars().all()
        return RecommendResponse(recommended_handles=list(handles))

    # Cosine distance search using pgvector
    result = await db.execute(
        select(ProductEmbedding.shopify_handle)
        .where(ProductEmbedding.benefit_embedding.isnot(None))
        .order_by(ProductEmbedding.benefit_embedding.cosine_distance(user.skin_embedding))
        .limit(5)
    )
    handles = result.scalars().all()
    return RecommendResponse(recommended_handles=list(handles))
