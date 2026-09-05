# Glass Skincare Scaffold Implementation Plan
# Glass Skincare Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a runnable Glass Skincare monorepo with FastAPI backend, Shopify Hydrogen frontend, Docker Postgres+Redis, all wired to a Shopify Partner dev store. 35 files total.

**Architecture:** Two-app monorepo (`backend/` = FastAPI AI engine, `hydrogen/` = Shopify Hydrogen storefront) plus Docker services for dev (Postgres with pgvector + Redis). Shopify owns commerce (cart, checkout, products, orders); FastAPI owns AI endpoints. Frontend deploys to Shopify Oxygen; backend stays on local server / cloud later.

**Tech Stack:** FastAPI 0.115, SQLAlchemy 2.0 async, Alembic, Pydantic v2, sentence-transformers 3.3, Anthropic SDK, Shopify Hydrogen 2.x, React Three Fiber (deferred), Tailwind, TypeScript, Docker (postgres:pg16 + pgvector extension + redis:7-alpine).

---

## File Map

**Created by this plan:**

| Path | Purpose |
|---|---|
| `.gitignore` | exclude node_modules, venv, .env, __pycache__ |
| `CLAUDE.md` | project context for Claude Code sessions |
| `README.md` | quick-start for humans |
| `docker-compose.yml` | Postgres + Redis for local dev |
| `backend/requirements.txt` | pinned Python deps |
| `backend/.env.example` | backend env template |
| `backend/alembic.ini` | Alembic config |
| `backend/app/__init__.py` | empty package marker |
| `backend/app/main.py` | FastAPI app, CORS, lifespan, router include |
| `backend/app/config.py` | Pydantic settings |
| `backend/app/database.py` | SQLAlchemy async engine + get_db |
| `backend/app/routers/__init__.py` | empty |
| `backend/app/routers/health.py` | GET /health endpoint |
| `backend/app/routers/ai.py` | placeholder AI router (returns 501) |
| `backend/app/models/__init__.py` | empty |
| `backend/app/models/user.py` | User model (skin_embedding vector(768)) |
| `backend/app/schemas/__init__.py` | empty |
| `backend/app/services/__init__.py` | empty |
| `backend/app/middleware/__init__.py` | empty |
| `backend/migrations/env.py` | Alembic env |
| `backend/migrations/script.py.mako` | Alembic template |
| `backend/migrations/versions/.gitkeep` | versions dir placeholder |
| `backend/scripts/.gitkeep` | scripts dir placeholder |
| `backend/tests/__init__.py` | empty |
| `backend/tests/test_health.py` | TDD test for health endpoint |
| `backend/tests/test_config.py` | TDD test for config loading |
| `backend/tests/test_database.py` | TDD test for DB connection |
| `hydrogen/package.json` | pinned Hydrogen deps |
| `hydrogen/.env.example` | Hydrogen env template |
| `hydrogen/vite.config.ts` | Vite config (Hydrogen preset) |
| `hydrogen/tailwind.config.ts` | Tailwind config (Glass Skincare palette) |
| `hydrogen/server.ts` | Oxygen entry: bootstrap Storefront client + Remix handler |
| `hydrogen/env.d.ts` | Ambient types for `context.storefront` + env vars |
| `hydrogen/tsconfig.json` | TS config (Hydrogen preset) |
| `hydrogen/app/root.tsx` | root layout |
| `hydrogen/app/routes/_index.tsx` | homepage with live Shopify fetch |
| `hydrogen/app/lib/shopify.ts` | Storefront API client wrapper |
| `hydrogen/app/components/.gitkeep` | component dirs placeholder |
| `hydrogen/app/storefrontQueries/.gitkeep` | queries dir placeholder |
| `hydrogen/public/models/.gitkeep` | models dir placeholder |

**Total: 39 files (2 more than spec count due to .gitkeep placeholders; +2 from server.ts + env.d.ts review fix).**

---

## Task 1: Root .gitignore

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Write `.gitignore`**

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
ENV/
.venv/
.pytest_cache/
.coverage
htmlcov/
.mypy_cache/
.ruff_cache/

# Node
node_modules/
.next/
.nuxt/
.vite/
dist/
build/
out/

# Environment
.env
.env.local
.env.*.local
!.env.example

# Logs
*.log
npm-debug.log*
yarn-debug.log*

# OS
.DS_Store
Thumbs.db
.idea/
.vscode/
*.swp
*.swo

# Docker
docker-compose.override.yml

# HuggingFace (model cache)
.cache/

# Worktrees (skill-managed)
.worktrees/
```

- [ ] **Step 2: Verify**

Run: `git check-ignore venv/ node_modules/ .env`
Expected: outputs the paths (means they would be ignored)

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: add root .gitignore"
```

---

## Task 2: CLAUDE.md (Project Context)

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Write `CLAUDE.md`**

```markdown
# Glass Skincare — Claude Code Context

## Project
AI-powered skincare e-commerce platform. Two domains: glassskincare.co (international) + glassskincare.in (India).

## Stack
- **Frontend:** Shopify Hydrogen 2.x (Remix/Vite) on Shopify Oxygen (edge)
- **Backend:** FastAPI 0.115 (Python 3.11) on local Mac / Windows Server in prod
- **DB:** PostgreSQL 16 + pgvector (Docker locally; native on Windows Server prod)
- **Cache:** Redis 7 (Docker locally; WSL2 on Windows Server prod)
- **AI:** Anthropic Claude Sonnet 4 (chat, vision), sentence-transformers all-MiniLM-L6-v2 (embeddings, 768-dim)
- **Commerce:** Shopify Hydrogen + Shopify Payments (no Stripe, no custom checkout)

## Source of Truth
- **Shopify** owns: products, inventory, cart, checkout, orders, payments, customers
- **FastAPI** owns: AI chat, skin quiz, photo analysis, recommendations, admin AI command bar
- **Postgres** owns: AI data only (users, skin_profiles, product_embeddings, ai_conversations, admin_actions)

## Hard Rules
1. Frontend (Hydrogen) calls FastAPI for AI features. Never call Anthropic directly from browser.
2. Hydrogen fetches products from Shopify Storefront API. Never duplicate product data in Postgres.
3. All AI calls go through `backend/app/services/ai_service.py`. Never call `anthropic.messages.create()` in a router.
4. All admin routes require `is_admin=true` in JWT.
5. Never hardcode secrets. Always read from `backend/app/config.py` (Pydantic settings).
6. 3D components use `.client.tsx` suffix and dynamic imports (Oxygen edge runtime has no WebGL).
7. uvloop is removed from requirements (Windows incompatibility per FINAL_PATCHES_V3 Fix 1).
8. pgvector dimension = 768 (sentence-transformers, not OpenAI 1536).

## Ports (dev)
- 3000 — Hydrogen frontend
- 8000 — FastAPI backend
- 5432 — Postgres (Docker)
- 6379 — Redis (Docker)
- 5050 — pgAdmin (optional, GUI)

## Current Phase
Phase 1 of Blueprint — scaffold + Shopify foundation. See `docs/superpowers/specs/2026-08-20-glass-skincare-scaffold-design.md` for the design.

## Blueprint Source
All architectural decisions live at `/Users/partharora/GLASSSKINCARE /Blueprint/`:
- MASTER_BLUEPRINT.md — overview
- DATABASE_SCHEMA.md — AI data tables only
- BACKEND_API.md — FastAPI endpoint reference
- AI_INTEGRATION.md — Claude prompts + service code
- DEPLOYMENT_GUIDE.md — Oxygen + Windows Server
- PORTALS_AND_SECURITY.md — security layer
- ARCHITECTURE_PATCHES.md + FINAL_PATCHES_V3.md — security + reliability patches

## What I'm Working On
Scaffold per `docs/superpowers/plans/2026-08-20-glass-skincare-scaffold.md`. Day 1–2 of IMPLEMENTATION_PLAN.md.
```

- [ ] **Step 2: Verify**

Run: `cat CLAUDE.md | head -10`
Expected: first 10 lines match the write content

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md context for Claude Code sessions"
```

---

## Task 3: README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

````markdown
# Glass Skincare

AI-powered skincare e-commerce. Shopify Hydrogen frontend, FastAPI AI engine, Anthropic Claude.

## Quick Start

```bash
# 1. Bring up Postgres + Redis
docker compose up -d

# 2. Backend
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in real values
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 3. Frontend (separate terminal)
cd hydrogen
npm install
cp .env.example .env  # fill in Shopify tokens
npm run dev
```

## Services

| Service | URL | Purpose |
|---|---|---|
| Hydrogen frontend | http://localhost:3000 | Shopify storefront |
| FastAPI backend | http://localhost:8000 | AI endpoints |
| FastAPI docs | http://localhost:8000/docs | OpenAPI/Swagger UI |
| Postgres | localhost:5432 | AI data |
| Redis | localhost:6379 | rate limiting, sessions |
| pgAdmin | http://localhost:5050 | DB GUI (optional) |

## Repository Layout

```
backend/       FastAPI AI engine
hydrogen/      Shopify Hydrogen storefront
docker-compose.yml   Postgres + Redis for dev
docs/superpowers/    specs + plans
```

## Documentation

See `docs/superpowers/specs/` for design + `docs/superpowers/plans/` for implementation tasks.

Full Blueprint at `../GLASSSKINCARE /Blueprint/` (10 master docs).

## Production

Frontend deploys to Shopify Oxygen (auto from GitHub). Backend on Windows Server with PM2 + Nginx. See `../GLASSSKINCARE /Blueprint/DEPLOYMENT_GUIDE.md`.
````

- [ ] **Step 2: Verify**

Run: `head -30 README.md`
Expected: title + Quick Start section visible

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README quick-start"
```

---

## Task 4: docker-compose.yml

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: glass-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: glass_skincare
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d glass_skincare"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: glass-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

- [ ] **Step 2: Write `backend/scripts/init-db.sql`**

```sql
-- Enable pgvector + uuid extensions on first container init
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
```

- [ ] **Step 3: Verify compose file is valid**

Run: `docker compose config --quiet`
Expected: exit 0, no output

- [ ] **Step 4: Bring up services**

Run: `docker compose up -d`
Expected output (last line):
```
✔ Network glasssskincare_default  Created
✔ Volume glasssskincare_postgres_data  Created
✔ Volume glasssskincare_redis_data  Created
✔ Container glass-postgres  Started
✔ Container glass-redis  Started
```

- [ ] **Step 5: Verify services healthy**

Run: `docker compose ps`
Expected: both containers show `running (healthy)`

- [ ] **Step 6: Verify Postgres extensions installed**

Run: `docker exec glass-postgres psql -U postgres -d glass_skincare -c "\dx"`
Expected output includes:
```
 pgvector  | vector     | ...
 uuid-ossp | uuid-ossp  | ...
```

- [ ] **Step 7: Verify Redis responds**

Run: `docker exec glass-redis redis-cli ping`
Expected: `PONG`

- [ ] **Step 8: Commit**

```bash
git add docker-compose.yml backend/scripts/init-db.sql
git commit -m "feat(docker): postgres+pgvector+redis compose for dev"
```

---

## Task 5: Backend requirements.txt

**Files:**
- Create: `backend/requirements.txt`

- [ ] **Step 1: Write `requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.32.0

sqlalchemy==2.0.36
asyncpg==0.30.0
alembic==1.14.0
psycopg2-binary==2.9.10
pgvector==0.3.5

pydantic==2.9.2
pydantic-settings==2.6.1
python-multipart==0.0.12

python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4

anthropic==0.40.0
sentence-transformers==3.3.1
torch==2.5.1
httpx==0.28.0

boto3==1.35.68
redis==5.2.0
pillow==11.0.0

pytest==8.3.3
pytest-asyncio==0.24.0
```

- [ ] **Step 2: Create venv + install**

```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

Expected: installs all packages, ends with `Successfully installed ...`

- [ ] **Step 3: Verify key imports work**

```bash
python -c "import fastapi, sqlalchemy, alembic, anthropic, sentence_transformers, pgvector; print('all imports ok')"
```

Expected: `all imports ok`

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt
git commit -m "feat(backend): pin Python deps per FINAL_PATCHES_V3"
```

---

## Task 6: Backend config (TDD)

**Files:**
- Create: `backend/app/__init__.py` (empty)
- Create: `backend/tests/__init__.py` (empty)
- Create: `backend/tests/test_config.py`
- Create: `backend/app/config.py`

- [ ] **Step 1: Create empty `__init__.py` files**

```bash
touch backend/app/__init__.py backend/tests/__init__.py
```

- [ ] **Step 2: Write failing test `backend/tests/test_config.py`**

```python
"""Test config loads from environment."""
import pytest
from app.config import settings


def test_settings_loads_database_url():
    """DATABASE_URL is required and parsed correctly."""
    assert settings.DATABASE_URL.startswith("postgresql+asyncpg://")


def test_settings_loads_anthropic_key():
    """ANTHROPIC_API_KEY is required."""
    assert settings.ANTHROPIC_API_KEY.startswith("sk-ant-")


def test_settings_allowed_origins_is_list():
    """ALLOWED_ORIGINS is parsed from comma-separated string to list."""
    assert isinstance(settings.ALLOWED_ORIGINS, list)
    assert "http://localhost:3000" in settings.ALLOWED_ORIGINS


def test_settings_environment_default():
    """ENVIRONMENT defaults to development when not set."""
    assert settings.ENVIRONMENT in {"development", "production", "staging"}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && source venv/bin/activate && pytest tests/test_config.py -v`
Expected: `ModuleNotFoundError: No module named 'app.config'`

- [ ] **Step 4: Write `.env` with test values**

Create `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/glass_skincare
REDIS_URL=redis://localhost:6379/0
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000
ANTHROPIC_API_KEY=sk-ant-test-fake-key-not-real
SECRET_KEY=test-secret-key-must-be-at-least-32-characters-long-for-hs256
SHOPIFY_STORE_DOMAIN=test-store.myshopify.com
SHOPIFY_ADMIN_API_TOKEN=shpat-test-fake
SHOPIFY_WEBHOOK_SECRET=test-webhook-secret
R2_ACCOUNT_ID=test-account
R2_ACCESS_KEY_ID=test-key
R2_SECRET_ACCESS_KEY=test-secret
R2_BUCKET_NAME=glass-skincare-assets
R2_PUBLIC_URL=https://assets.glassskincare.co
AI_CHALLENGE_SECRET=test-challenge-secret-32-chars-minimum-aaa
```

Also create `backend/.env.example` (same content, safe to commit):

```bash
cp backend/.env backend/.env.example
```

- [ ] **Step 5: Write `backend/app/config.py`**

```python
"""Pydantic settings loaded from backend/.env."""
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    ANTHROPIC_API_KEY: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 30

    SHOPIFY_STORE_DOMAIN: str = ""
    SHOPIFY_ADMIN_API_TOKEN: str = ""
    SHOPIFY_WEBHOOK_SECRET: str = ""

    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""
    R2_PUBLIC_URL: str = ""

    AI_CHALLENGE_SECRET: str = ""

    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse comma-separated ALLOWED_ORIGINS into list."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


# Alias for backward compat with tests that import ALLOWED_ORIGINS directly
settings = Settings()
settings.ALLOWED_ORIGINS = settings.allowed_origins_list
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && source venv/bin/activate && pytest tests/test_config.py -v`
Expected: 4 tests pass

- [ ] **Step 7: Commit**

```bash
git add backend/app/__init__.py backend/tests/__init__.py backend/tests/test_config.py backend/app/config.py backend/.env.example
git commit -m "feat(config): Pydantic settings with test coverage"
```

Note: `backend/.env` is gitignored.

---

## Task 7: Backend database (TDD)

**Files:**
- Create: `backend/app/database.py`
- Create: `backend/tests/test_database.py`

- [ ] **Step 1: Write failing test `backend/tests/test_database.py`**

```python
"""Test database engine + session factory."""
import pytest
from sqlalchemy import text
from app.database import engine, get_db


def test_engine_creates_async_engine():
    """Engine is async and bound to DATABASE_URL."""
    assert engine is not None
    assert "postgresql+asyncpg" in str(engine.url)


@pytest.mark.asyncio
async def test_can_connect_to_postgres():
    """Engine can execute SELECT 1 against running Postgres."""
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT 1"))
        assert result.scalar() == 1


@pytest.mark.asyncio
async def test_get_db_yields_session():
    """get_db dependency yields a session that can query."""
    async for session in get_db():
        result = await session.execute(text("SELECT current_database()"))
        db_name = result.scalar()
        assert db_name == "glass_skincare"
        break
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && source venv/bin/activate && pytest tests/test_database.py -v`
Expected: `ModuleNotFoundError: No module named 'app.database'`

- [ ] **Step 3: Write `backend/app/database.py`**

```python
"""SQLAlchemy async engine + session factory + get_db dependency."""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


async def get_db():
    """FastAPI dependency: yields AsyncSession, rolls back on error."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && source venv/bin/activate && pytest tests/test_database.py -v`
Expected: 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/app/database.py backend/tests/test_database.py
git commit -m "feat(database): SQLAlchemy async engine + get_db dependency"
```

---

## Task 8: Backend health endpoint (TDD)

**Files:**
- Create: `backend/app/main.py`
- Create: `backend/app/routers/__init__.py` (empty)
- Create: `backend/app/routers/health.py`
- Create: `backend/tests/test_health.py`

- [ ] **Step 1: Create empty `__init__.py`**

```bash
touch backend/app/routers/__init__.py
```

- [ ] **Step 2: Write failing test `backend/tests/test_health.py`**

```python
"""Test /health endpoint."""
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_health_returns_200():
    """GET /health returns HTTP 200."""
    response = client.get("/health")
    assert response.status_code == 200


def test_health_returns_status_ok():
    """GET /health returns JSON with status='ok'."""
    response = client.get("/health")
    assert response.json() == {"status": "ok"}


def test_docs_endpoint_available():
    """GET /docs serves Swagger UI."""
    response = client.get("/docs")
    assert response.status_code == 200
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && source venv/bin/activate && pytest tests/test_health.py -v`
Expected: `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 4: Write `backend/app/routers/health.py`**

```python
"""Health check endpoint."""
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    """Liveness probe. Always returns ok if app is running."""
    return {"status": "ok"}
```

- [ ] **Step 5: Write `backend/app/main.py`**

```python
"""FastAPI application entry point."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine
from app.routers import health, ai


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-AI-Session-Token", "stripe-signature"],
)

app.include_router(health.router)
app.include_router(ai.router)
```

- [ ] **Step 6: Write placeholder `backend/app/routers/ai.py`**

```python
"""AI router placeholder. Real endpoints land in Phase 3 of Blueprint."""
from fastapi import APIRouter

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/placeholder")
async def placeholder():
    """Returns 200 to confirm router is wired. Will be replaced by real AI endpoints."""
    return {"status": "ai_router_wired", "note": "real endpoints in Blueprint Phase 3"}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd backend && source venv/bin/activate && pytest tests/test_health.py -v`
Expected: 3 tests pass

- [ ] **Step 8: Run all tests**

Run: `cd backend && source venv/bin/activate && pytest -v`
Expected: all tests pass (10 total across config + database + health)

- [ ] **Step 9: Start server and curl /health**

```bash
cd backend && source venv/bin/activate
uvicorn app.main:app --port 8000 &
sleep 3
curl -sf http://localhost:8000/health
```

Expected: `{"status":"ok"}`

```bash
curl -sf http://localhost:8000/ai/placeholder
```

Expected: `{"status":"ai_router_wired","note":"real endpoints in Blueprint Phase 3"}`

```bash
curl -sfI http://localhost:8000/docs | head -1
```

Expected: `HTTP/1.1 200 OK`

- [ ] **Step 10: Stop server**

```bash
pkill -f "uvicorn app.main:app"
```

- [ ] **Step 11: Commit**

```bash
git add backend/app/main.py backend/app/routers/__init__.py backend/app/routers/health.py backend/app/routers/ai.py backend/tests/test_health.py
git commit -m "feat(api): FastAPI app + /health + /ai placeholder"
```

---

## Task 9: Backend User model + Alembic init + first migration

**Files:**
- Create: `backend/app/models/__init__.py` (empty)
- Create: `backend/app/models/user.py`
- Create: `backend/alembic.ini`
- Create: `backend/migrations/env.py`
- Create: `backend/migrations/script.py.mako`
- Create: `backend/migrations/versions/.gitkeep`

- [ ] **Step 1: Create empty `__init__.py`**

```bash
touch backend/app/models/__init__.py
```

- [ ] **Step 2: Write `backend/app/models/user.py`**

```python
"""User model. Maps AI profiles to Shopify customer accounts."""
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shopify_customer_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    skin_embedding: Mapped[list | None] = mapped_column(Vector(768), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
```

- [ ] **Step 3: Write `backend/alembic.ini`**

```ini
[alembic]
script_location = migrations
prepend_sys_path = .
sqlalchemy.url = driver://user:pass@localhost/dbname

[post_write_hooks]

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 4: Write `backend/migrations/env.py`**

```python
"""Alembic env: uses backend.app.config for DATABASE_URL + imports all models."""
from logging.config import fileConfig
import sys
from pathlib import Path
from sqlalchemy import engine_from_config, pool
from alembic import context

# Add backend dir to path so 'app' package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.database import Base  # noqa: E402
from app.models import user  # noqa: E402, F401  (registers model with Base.metadata)

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("+asyncpg", ""))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 5: Write `backend/migrations/script.py.mako`**

```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 6: Create versions dir placeholder**

```bash
touch backend/migrations/versions/.gitkeep
```

- [ ] **Step 7: Generate first migration**

```bash
cd backend && source venv/bin/activate
alembic revision --autogenerate -m "create users table"
```

Expected: creates `backend/migrations/versions/<hash>_create_users_table.py`

- [ ] **Step 8: Verify migration file references users table + vector column**

Run: `grep -E "users|vector" backend/migrations/versions/*create_users*.py`
Expected: matches `users`, `vector(768)`, `email`, `skin_embedding`

- [ ] **Step 9: Apply migration**

```bash
cd backend && source venv/bin/activate
alembic upgrade head
```

Expected output (last line): `Running upgrade  -> <hash>, create users table`

- [ ] **Step 10: Verify table created in Postgres**

```bash
docker exec glass-postgres psql -U postgres -d glass_skincare -c "\dt"
```

Expected: includes `users` table

```bash
docker exec glass-postgres psql -U postgres -d glass_skincare -c "\d users"
```

Expected: shows columns including `skin_embedding vector(768)`

- [ ] **Step 11: Commit**

```bash
git add backend/app/models/__init__.py backend/app/models/user.py backend/alembic.ini backend/migrations/ backend/migrations/versions/.gitkeep
git commit -m "feat(db): User model + Alembic init + first migration"
```

---

## Task 10: Hydrogen package.json

**Files:**
- Create: `hydrogen/package.json`

- [ ] **Step 1: Write `hydrogen/package.json`**

```json
{
  "name": "glass-skincare-hydrogen",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "shopify hydrogen dev --codegen",
    "build": "shopify hydrogen build",
    "preview": "shopify hydrogen preview",
    "deploy": "shopify hydrogen deploy",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@remix-run/react": "^2.15.2",
    "@shopify/hydrogen": "^2025.1.0",
    "@shopify/remix-oxygen": "^2.1.0",
    "isbot": "^5.1.17",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@remix-run/dev": "^2.15.2",
    "@shopify/cli": "^3.80.0",
    "@shopify/cli-hydrogen": "^5.0.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.0",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vite": "^6.0.5",
    "vite-tsconfig-paths": "^5.1.4"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 2: Install deps**

```bash
cd hydrogen
npm install
```

Expected: installs all packages, no errors

- [ ] **Step 3: Verify Hydrogen CLI available**

Run: `cd hydrogen && npx shopify hydrogen --version`
Expected: prints version (e.g., `5.x.x`)

- [ ] **Step 4: Commit**

```bash
git add hydrogen/package.json hydrogen/package-lock.json
git commit -m "feat(hydrogen): package.json + Shopify Hydrogen 2.x deps"
```

---

## Task 11: Hydrogen configs (vite, tailwind, tsconfig)

**Files:**
- Create: `hydrogen/vite.config.ts`
- Create: `hydrogen/tailwind.config.ts`
- Create: `hydrogen/postcss.config.js`
- Create: `hydrogen/tsconfig.json`

- [ ] **Step 1: Write `hydrogen/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import { hydrogen } from "@shopify/hydrogen/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [hydrogen(), tsconfigPaths()],
  server: {
    port: 3000,
  },
});
```

- [ ] **Step 2: Write `hydrogen/tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        "glass-cream": "#F5F0EB",
        "glass-sand": "#E8DDD2",
        "glass-tan": "#C9A98A",
        "glass-brown": "#8B7355",
        "glass-charcoal": "#1A1A1A",
        "glass-white": "#FDFCFB",
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', "serif"],
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 3: Write `hydrogen/postcss.config.js`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4a: Write `hydrogen/server.ts`**

Without this entry, `context.storefront` is undefined in loaders and the app crashes on load. Hydrogen's CLI normally generates it from `npx shopify hydrogen link`, but for hand-scaffold we ship it directly.

```typescript
import { createRequestHandler } from "@shopify/remix-oxygen";
import { createStorefrontClient } from "@shopify/hydrogen";
import * as remixBuild from "@remix-run/dev/server-build";

export default {
  async fetch(request: Request, env: Env, executionContext: ExecutionContext) {
    const { storefront } = createStorefrontClient({
      cache: await caches.open("hydrogen"),
      waitUntil: executionContext.waitUntil.bind(executionContext),
      i18n: { language: "EN", country: "US" },
      publicStorefrontToken: env.PUBLIC_STOREFRONT_API_TOKEN,
      privateStorefrontToken: env.PRIVATE_STOREFRONT_API_TOKEN,
      storeDomain: env.PUBLIC_STORE_DOMAIN,
      storefrontId: env.PUBLIC_STOREFRONT_ID,
      storefrontHeaders: request.headers,
    });

    const handleRequest = createRequestHandler({
      build: remixBuild,
      mode: process.env.NODE_ENV,
      getLoadContext: () => ({ storefront, env }),
    });

    return handleRequest(request);
  },
};
```

- [ ] **Step 4b: Write `hydrogen/env.d.ts`**

Augments `AppLoadContext` so `tsc --noEmit` accepts `context.storefront`.

```typescript
/// <reference types="vite/client" />
/// <reference types="@shopify/remix-oxygen" />
/// <reference types="@shopify/hydrogen" />

import type { Storefront } from "@shopify/hydrogen";

interface Env {
  PUBLIC_STORE_DOMAIN: string;
  PUBLIC_STOREFRONT_API_TOKEN: string;
  PRIVATE_STOREFRONT_API_TOKEN: string;
  PUBLIC_STOREFRONT_ID: string;
  SESSION_SECRET: string;
}

declare module "@shopify/remix-oxygen" {
  export interface AppLoadContext {
    env: Env;
    storefront: Storefront;
  }
}
```

- [ ] **Step 4: Write `hydrogen/tsconfig.json`**

```json
{
  "include": ["app/**/*", "*.ts", "*.tsx"],
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "isolatedModules": true,
    "esModuleInterop": true,
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "target": "ES2022",
    "strict": true,
    "allowJs": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "~/*": ["./app/*"]
    },
    "noEmit": true
  }
}
```

- [ ] **Step 5: Verify TypeScript compiles (no actual files yet — should report no errors)**

```bash
cd hydrogen && npx tsc --noEmit
```

Expected: no errors (or only "Cannot find module" warnings for `~/...` paths if no source files exist yet — acceptable)

- [ ] **Step 6: Commit**

```bash
git add hydrogen/vite.config.ts hydrogen/tailwind.config.ts hydrogen/postcss.config.js hydrogen/server.ts hydrogen/env.d.ts hydrogen/tsconfig.json
git commit -m "feat(hydrogen): vite/tailwind/tsconfig + oxygen server bootstrap"
```

---

## Task 12: Hydrogen root + homepage

**Files:**
- Create: `hydrogen/app/root.tsx`
- Create: `hydrogen/app/routes/_index.tsx`
- Create: `hydrogen/app/tailwind.css`
- Create: `hydrogen/app/components/.gitkeep`
- Create: `hydrogen/app/storefrontQueries/.gitkeep`

- [ ] **Step 1: Create placeholder dirs**

```bash
mkdir -p hydrogen/app/components/3d hydrogen/app/components/consumer hydrogen/app/components/ui hydrogen/app/storefrontQueries
touch hydrogen/app/components/.gitkeep hydrogen/app/storefrontQueries/.gitkeep
```

- [ ] **Step 2: Write `hydrogen/app/tailwind.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #F5F0EB;
  color: #1A1A1A;
  font-family: Inter, sans-serif;
  font-weight: 300;
}

h1, h2, h3 {
  font-family: "Cormorant Garamond", serif;
  font-weight: 300;
  letter-spacing: -0.02em;
}
```

- [ ] **Step 3: Write `hydrogen/app/root.tsx`**

```typescript
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import tailwindHref from "./tailwind.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: tailwindHref },
  {
    rel: "preconnect",
    href: "https://fonts.googleapis.com",
  },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Inter:wght@300;400;500&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
```

- [ ] **Step 4: Write `hydrogen/app/routes/_index.tsx`**

```typescript
import type { LoaderFunctionArgs, MetaFunction } from "@shopify/hydrogen";
import { useLoaderData } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "Glass Skincare — Your skin, finally understood." },
    {
      name: "description",
      content: "AI-powered skincare, made for Indian skin.",
    },
  ];
};

export async function loader({ context }: LoaderFunctionArgs) {
  // Fetch featured products from Shopify Storefront API
  const { products } = await context.storefront.query(PRODUCTS_QUERY, {
    variables: { first: 3 },
  });
  return { products: products.nodes };
}

const PRODUCTS_QUERY = `#graphql
  query FeaturedProducts($first: Int!) {
    products(first: $first) {
      nodes {
        id
        title
        handle
        description
        featuredImage {
          url
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;

export default function Index() {
  const { products } = useLoaderData<typeof loader>();

  return (
    <main className="min-h-screen bg-glass-cream">
      <header className="px-8 py-6 flex justify-between items-center">
        <h1 className="text-3xl font-serif">Glass Skincare</h1>
        <a href="/products" className="text-sm text-glass-brown hover:text-glass-charcoal">
          Shop
        </a>
      </header>

      <section className="px-8 py-24 text-center">
        <h2 className="text-6xl font-serif mb-4">Your skin, finally understood.</h2>
        <p className="text-glass-brown mb-8">AI-powered skincare, made for Indian skin.</p>
        <a
          href="/skin-quiz"
          className="inline-block px-8 py-3 bg-glass-charcoal text-glass-white rounded"
        >
          Discover your routine →
        </a>
      </section>

      <section className="px-8 py-16 max-w-6xl mx-auto">
        <h3 className="text-4xl font-serif mb-8">Featured products</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {products.map((product: any) => (
            <article key={product.id} className="bg-glass-white p-6 rounded">
              {product.featuredImage && (
                <img
                  src={product.featuredImage.url}
                  alt={product.featuredImage.altText || product.title}
                  className="w-full h-64 object-cover mb-4"
                />
              )}
              <h4 className="text-xl font-serif mb-2">{product.title}</h4>
              <p className="text-sm text-glass-brown mb-4">{product.description}</p>
              <p className="font-medium">
                {product.priceRange.minVariantPrice.amount}{" "}
                {product.priceRange.minVariantPrice.currencyCode}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add hydrogen/app/root.tsx hydrogen/app/routes/_index.tsx hydrogen/app/tailwind.css hydrogen/app/components/.gitkeep hydrogen/app/storefrontQueries/.gitkeep
git commit -m "feat(hydrogen): root layout + homepage with live Shopify fetch"
```

---

## Task 13: Hydrogen lib/shopify.ts

**Files:**
- Create: `hydrogen/app/lib/shopify.ts`

- [ ] **Step 1: Write `hydrogen/app/lib/shopify.ts`**

```typescript
/**
 * Storefront API client helpers.
 * Hydrogen exposes context.storefront; this module adds typed query builders
 * + product shape utilities. Defer per-query logic to /storefrontQueries/.
 */

export interface Money {
  amount: string;
  currencyCode: string;
}

export interface ProductImage {
  url: string;
  altText: string | null;
}

export interface ShopifyProductSummary {
  id: string;
  title: string;
  handle: string;
  description: string;
  featuredImage: ProductImage | null;
  priceRange: { minVariantPrice: Money };
}

export async function fetchProductsByHandles(
  storefront: { query: (q: string, opts: { variables: Record<string, unknown> }) => Promise<{ products: { nodes: ShopifyProductSummary[] } }> },
  handles: string[],
): Promise<ShopifyProductSummary[]> {
  if (handles.length === 0) return [];

  const PRODUCTS_BY_HANDLE = `#graphql
    query ProductsByHandle($query: String!) {
      products(first: 50, query: $query) {
        nodes {
          id
          title
          handle
          description
          featuredImage { url altText }
          priceRange { minVariantPrice { amount currencyCode } }
        }
      }
    }
  `;

  const query = handles.map((h) => `handle:${h}`).join(" OR ");
  const { products } = await storefront.query(PRODUCTS_BY_HANDLE, {
    variables: { query },
  });
  return products.nodes;
}
```

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
cd hydrogen && npx tsc --noEmit
```

Expected: no errors (or only known minor warnings)

- [ ] **Step 3: Commit**

```bash
git add hydrogen/app/lib/shopify.ts
git commit -m "feat(hydrogen): Storefront API client helpers"
```

---

## Task 14: Hydrogen .env.example

**Files:**
- Create: `hydrogen/.env.example`

- [ ] **Step 1: Write `hydrogen/.env.example`**

```env
# Shopify — populated by `npx shopify hydrogen link`
SESSION_SECRET=replace-with-random-64-char-string
PUBLIC_STORE_DOMAIN=your-store.myshopify.com
PUBLIC_STOREFRONT_API_TOKEN=your-storefront-api-token
PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID=your-customer-account-client-id
PUBLIC_CUSTOMER_ACCOUNT_API_URL=https://shopify.com/account/customer/api/2024-01/graphql
SHOP_ID=00000000000

# FastAPI backend
FASTAPI_URL=http://localhost:8000

# Cloudflare R2 (defer until Phase 4 — 3D models)
PUBLIC_R2_URL=https://assets.glassskincare.co
```

- [ ] **Step 2: Commit**

```bash
git add hydrogen/.env.example
git commit -m "docs(hydrogen): .env.example template"
```

---

## Task 15: Hydrogen link to Shopify (interactive)

**This task is user-driven (browser auth).** Claude provides instructions; user runs commands.

- [ ] **Step 1: User logs in to Shopify CLI**

```bash
cd hydrogen
npx shopify login
```

User action: browser opens → log in → grant permissions

Expected: terminal prints `Logged in as <email>`

- [ ] **Step 2: User creates dev store (if not already done)**

If user has no Shopify Partner account yet, walk through:

1. Visit https://partners.shopify.com → Sign up (free)
2. Stores → Add store → Development store
3. Name: `glass-skincare-dev`
4. Skip "What type of products" prompts

- [ ] **Step 3: Link Hydrogen to dev store**

```bash
cd hydrogen
npx shopify hydrogen link
```

User action: pick `glass-skincare-dev` from list → confirm

Expected output (last line): `Linked to <store>.myshopify.com`

- [ ] **Step 4: Verify .env populated**

```bash
cat hydrogen/.env
```

Expected: contains `PUBLIC_STORE_DOMAIN=...myshopify.com`, `PUBLIC_STOREFRONT_API_TOKEN=...`, `SHOP_ID=...`

- [ ] **Step 5: Commit `.env` is gitignored (sanity check)**

```bash
git check-ignore hydrogen/.env
```

Expected: outputs `hydrogen/.env` (means it's ignored)

- [ ] **Step 6: Add demo products in Shopify Admin**

User action:
1. Visit Shopify Admin: https://admin.shopify.com/store/<store-name>
2. Products → Add product → repeat 3 times with placeholder names ("Serum 1", "Serum 2", "Cream 1")
3. Add at least one image each (any placeholder)

- [ ] **Step 7: Commit (no new files, but record progress)**

```bash
git commit --allow-empty -m "chore: hydrogen linked to Shopify dev store + demo products added"
```

---

## Task 16: End-to-end smoke test

**Verify everything runs together.**

- [ ] **Step 1: Start all services**

Terminal 1 (Docker already running from Task 4 — verify):

```bash
docker compose ps
```

Expected: both `glass-postgres` and `glass-redis` show `running (healthy)`

- [ ] **Step 2: Start FastAPI**

Terminal 2:

```bash
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Expected output (last line): `Uvicorn running on http://0.0.0.0:8000`

- [ ] **Step 3: Verify FastAPI health**

Terminal 3:

```bash
curl -sf http://localhost:8000/health
```

Expected: `{"status":"ok"}`

```bash
curl -sf http://localhost:8000/ai/placeholder
```

Expected: `{"status":"ai_router_wired","note":"real endpoints in Blueprint Phase 3"}`

- [ ] **Step 4: Start Hydrogen**

Terminal 4:

```bash
cd hydrogen && npm run dev
```

Expected output: `Local: http://localhost:3000` after build completes

- [ ] **Step 5: Verify Hydrogen responds**

Terminal 3:

```bash
curl -sfI http://localhost:3000 | head -1
```

Expected: `HTTP/1.1 200 OK`

- [ ] **Step 6: Verify homepage renders products from Shopify**

Terminal 3:

```bash
curl -s http://localhost:3000 | grep -E "Glass Skincare|Featured products" | head -5
```

Expected: matches both "Glass Skincare" and "Featured products"

- [ ] **Step 7: Verify products visible in browser**

User action: open http://localhost:3000 in Chrome → confirm "Featured products" section shows the 3 demo products from Task 15 Step 6

- [ ] **Step 8: Verify pgAdmin shows users table**

User action: open pgAdmin → connect to `localhost:5432` → navigate to `glass_skincare` → `Schemas` → `public` → `Tables`

Expected: at least `users` table visible; `alembic_version` table also present

- [ ] **Step 9: Run all tests**

```bash
cd backend && source venv/bin/activate && pytest -v
```

Expected: all tests pass (10 across config + database + health)

- [ ] **Step 10: Final commit**

```bash
cd /Users/partharora/GLASSSKINCARE
git status
```

If any new untracked files, add + commit:

```bash
git add -A
git commit -m "chore: scaffold complete — all services verified running"
```

- [ ] **Step 11: Stop services**

```bash
pkill -f "uvicorn app.main:app" || true
pkill -f "shopify hydrogen dev" || true
# Keep Docker running for further development
```

---

## Acceptance

All 16 tasks complete when:

- ✅ `docker compose ps` shows both services healthy
- ✅ `curl localhost:8000/health` returns `{"status":"ok"}`
- ✅ `curl localhost:3000` returns 200 + HTML with "Glass Skincare"
- ✅ pgAdmin shows `users` table in `glass_skincare` database
- ✅ Homepage at localhost:3000 displays Shopify demo products
- ✅ `pytest -v` shows 10 tests passing
- ✅ Git log shows clean commits per task

This scaffold unblocks Blueprint Phase 1 (AI features, 3D, admin) to begin.

---

## Next Steps After This Plan

Invoke `superpowers:writing-plans` again for the **next scaffold task** (e.g., implement real AI endpoints, add 3D viewer, wire webhooks). Each feature gets its own brainstorm → spec → plan → implement cycle.

Or invoke `superpowers:executing-plans` now to execute this plan step-by-step.