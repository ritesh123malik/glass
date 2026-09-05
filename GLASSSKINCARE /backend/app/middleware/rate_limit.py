"""Redis-backed rate limiting middleware."""
import redis.asyncio as redis
from fastapi import Request, HTTPException
from app.config import settings

_redis: redis.Redis | None = None

async def get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis

async def rate_limit(
    request: Request,
    max_calls: int,
    window_seconds: int,
    key: str | None = None,
) -> None:
    """Raise HTTPException 429 if request count exceeds max_calls in window.
    If Redis is unreachable, no-op (logged once) so the API stays available
    during local dev when the cache isn't running.

    `key` lets callers compose a custom counter namespace (e.g.
    `admin_cmd:{admin_id}:{action}` for per-action caps). When omitted,
    the key falls back to `rate:{ip}:{path}`.
    """
    try:
        r = await get_redis()
        if key is None:
            ip = request.client.host
            key = f"rate:{ip}:{request.url.path}"
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, window_seconds)
        if count > max_calls:
            raise HTTPException(status_code=429, detail="Too many requests. Slow down.")
    except HTTPException:
        # Re-raise 429s — don't swallow them as "Redis unavailable".
        raise
    except (ConnectionError, OSError, Exception) as e:
        # Redis not running (dev) — skip rate limiting rather than 500.
        if not hasattr(rate_limit, "_warned"):
            print(f"[rate_limit] Redis unavailable, skipping: {e}")
            rate_limit._warned = True  # type: ignore[attr-defined]
        return
