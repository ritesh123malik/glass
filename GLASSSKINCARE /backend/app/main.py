"""FastAPI application entry point."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine
from app.middleware.request_size import RequestSizeLimitMiddleware
from app.routers import health, ai, auth, admin, sync


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Connect to DB on startup, dispose on shutdown."""
    yield
    await engine.dispose()


app = FastAPI(
    title="Glass Skincare AI API",
    description="AI endpoints for Glass Skincare (chat, quiz, recommendations, admin)",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS is added first so RequestSizeLimit becomes the OUTERMOST middleware
# (FastAPI wraps the most-recently-added middleware outermost). That way we
# reject oversized bodies before CORS or any other middleware touches them.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-AI-Session-Token", "stripe-signature"],
)

# FINAL_PATCHES_V3 Fix 9 — 10 MB hard cap on request bodies.
app.add_middleware(RequestSizeLimitMiddleware, max_bytes=10 * 1024 * 1024)

app.include_router(health.router)
app.include_router(ai.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(sync.router)
