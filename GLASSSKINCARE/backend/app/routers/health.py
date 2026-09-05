"""Health check endpoint."""
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    """Liveness probe. Always returns ok if app is running."""
    return {"status": "ok"}
