# Glass Skincare — Scaffold Design

**Date:** 2026-08-20
**Status:** Approved (sections 1–5)
**Owner:** Founder
**Source spec:** `/Users/partharora/GLASSSKINCARE /Blueprint/` (10 markdown files, v3 patches applied)
**Target:** Day 1–2 of IMPLEMENTATION_PLAN.md

---

## Purpose

Scaffold the Glass Skincare project so that:

- Backend (FastAPI) runs locally with health endpoint, SQLAlchemy engine, Alembic migrations applied
- Frontend (Shopify Hydrogen) runs locally, linked to a Shopify Partner dev store
- Postgres + Redis run in Docker (dev only)
- pgAdmin can connect to Docker Postgres and inspect tables
- Git initialized with first commit
- No features implemented (AI, 3D, admin portal deferred to later phases)

This unblocks all subsequent Phase 1+ work from the Blueprint.

---

## Section 1 — Project Layout

```
/Users/partharora/GLASSSKINCARE/
├── CLAUDE.md                          # Claude Code context
├── README.md                          # quick-start guide
├── .gitignore                         # node_modules, .env, __pycache__, etc.
├── docker-compose.yml                 # postgres + pgvector + redis (dev)
├── backend/                           # FastAPI AI engine
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI app, CORS, health, lifespan
│   │   ├── config.py                  # Pydantic settings from env
│   │   ├── database.py                # SQLAlchemy async engine, get_db
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── health.py              # GET /health
│   │   │   └── ai.py                  # placeholder AI endpoints
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── user.py                # scaffold model (from DATABASE_SCHEMA.md)
│   │   ├── schemas/__init__.py
│   │   ├── services/__init__.py
│   │   └── middleware/__init__.py
│   ├── migrations/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   ├── scripts/
│   │   └── sync_shopify_catalog.py    # one-shot (later)
│   ├── requirements.txt               # pinned per FINAL_PATCHES_V3
│   ├── alembic.ini
│   └── .env.example
├── hydrogen/                          # Shopify Hydrogen frontend
│   ├── app/
│   │   ├── root.tsx                   # shell layout
│   │   ├── routes/
│   │   │   ├── _index.tsx             # homepage, live Shopify product fetch
│   │   │   └── products._index.tsx    # placeholder list
│   │   ├── components/
│   │   │   ├── 3d/                    # empty for now
│   │   │   ├── consumer/              # empty for now
│   │   │   └── ui/                    # empty for now
│   │   ├── lib/
│   │   │   └── shopify.ts             # Storefront API client wrapper
│   │   └── storefrontQueries/         # empty for now
│   ├── public/models/                 # .glb later
│   ├── package.json                   # pinned Hydrogen deps
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── .env.example
└── docs/superpowers/specs/2026-08-20-glass-skincare-scaffold-design.md
```

**File count:** 35 total (backend 17, hydrogen 11, root 4, docs 1, docker-compose 1, gitignore 1).

---

## Section 2 — Account Walkthrough Order

Order matters because some accounts depend on others.

| # | Account | Time | Why now | Defer? |
|---|---|---|---|---|
| 1 | GitHub | 5 min | Universal, OAuth for many tools | No |
| 2 | Shopify Partner + dev store | 10 min | Frontend foundation | No |
| 3 | Anthropic | 3 min | AI features (later phases) | No (cheap) |
| 4 | Cloudflare | 5 min | api subdomain DNS, R2 | Yes (deployment day) |
| 5 | R2 bucket | 5 min | 3D model assets | Yes (Phase 4 of Blueprint) |

**Save-to-paste-back list:**

```
GITHUB_USERNAME=___
SHOPIFY_STORE_DOMAIN=___.myshopify.com
SHOPIFY_STOREFRONT_TOKEN=___
SHOPIFY_ADMIN_TOKEN=___
ANTHROPIC_API_KEY=sk-ant-___
CLOUDFLARE_ACCOUNT_ID=___        # later
R2_ACCESS_KEY_ID=___             # later
R2_SECRET_ACCESS_KEY=___         # later
```

**This session needs 1–3. Items 4–5 defer to deployment / 3D phase.**

---

## Section 3 — Init/Install Order

```
Step 1 — scaffold files (Claude writes, user reviews)
  CLAUDE.md, README.md, .gitignore, docker-compose.yml
  backend/* (17 files)
  hydrogen/* (11 files)
  docs/superpowers/specs/2026-08-20-glass-skincare-scaffold-design.md
  estimated: ~5 min

Step 2 — git init + first commit
  git init (already done; repo on main)
  git add . && git commit -m "scaffold: initial project structure from Blueprint v3"
  estimated: 1 min

Step 3 — Docker up
  docker compose up -d
  verify: docker ps → postgres + redis running
  estimated: 2 min

Step 4 — Python deps
  cd backend
  python3.11 -m venv venv && source venv/bin/activate
  pip install -r requirements.txt
  alembic upgrade head
  estimated: 5–8 min (sentence-transformers ~120 MB)

Step 5 — FastAPI up
  uvicorn app.main:app --reload --port 8000
  curl http://localhost:8000/health → {"status":"ok"}
  estimated: 1 min

Step 6 — Node deps
  cd ../hydrogen && npm install
  estimated: 3–5 min (Hydrogen deps)

Step 7 — link to Shopify
  npx shopify login
  npx shopify hydrogen link → pick glass-skincare-dev
  cp .env.example .env → fill from saved credentials
  estimated: 5 min (browser + token paste)

Step 8 — Hydrogen up
  npm run dev
  curl http://localhost:3000 → 200 OK
  estimated: 2 min
```

**Order dependencies:**

- Docker before Python (Postgres must exist for Alembic)
- Python before FastAPI (deps must exist)
- Node before Shopify link (CLI must exist)
- Shopify link before Hydrogen dev (env must have tokens)

**Total install time: 25–35 min.**

---

## Section 4 — Run Order + Success Criteria

**Run order after install complete:**

```
Terminal 1 (Docker, daemonized):
  docker compose up -d
  verify: docker ps → 2 containers, ports 5432 + 6379
  state: persistent across restarts

Terminal 2 (FastAPI):
  cd backend && source venv/bin/activate
  uvicorn app.main:app --reload --port 8000
  verify: curl -sf http://localhost:8000/health
  expected: {"status":"ok"} + HTTP 200

Terminal 3 (Hydrogen):
  cd hydrogen && npm run dev
  verify: curl -sfI http://localhost:3000
  expected: HTTP/1.1 200 OK
  also: open http://localhost:3000 in browser → homepage renders, products from Shopify dev store visible

Terminal 4 (pgAdmin, GUI):
  connect: host=postgres, port=5432, user=postgres, pass from .env
  verify: Databases → glass_skincare → Schemas → public → Tables count = 5
  expected tables: users, skin_profiles, product_embeddings, ai_conversations, admin_actions
```

**Success criteria — all must pass:**

```
✅ docker compose ps → both services healthy
✅ curl localhost:8000/health → 200 + JSON status
✅ curl localhost:3000 → 200 + HTML response
✅ pgAdmin shows 5 tables in glass_skincare
✅ Shopify dev store demo product visible at localhost:3000/products
✅ git status → clean (committed)
✅ ls docs/superpowers/specs/ → spec file exists
```

**Failure rollback:** each step independent. Docker failure blocks only Postgres/Redis. FastAPI works with mocked deps. Hydrogen works without Shopify link (shows empty state).

---

## Section 5 — Out of Scope

Explicit non-goals for this session:

| Deferred item | Source phase | Why defer |
|---|---|---|
| AI features (chat, skin quiz, photo analysis) | Blueprint Phase 3, Week 5 | Requires Anthropic key + stable DB |
| 3D scenes (Hero, ProductViewer) | Blueprint Phase 4, Week 6 | Requires .glb models from product team |
| Admin portal + AI command bar | Blueprint Phase 5, Week 6 | Requires Shopify Admin token + routing |
| Shopify webhook handlers | Blueprint Phase 1, Day 6–7 | Requires dev store + product added |
| Product catalog (real SKUs) | User-side | Manual work, not scaffold concern |
| Sentry, structlog, OAuth challenges, rate limiting | FINAL_PATCHES_V3 | Pre-launch hardening |
| Production deployment (Oxygen, Windows Server) | Blueprint Phase 6, Week 7 | Requires domains, Cloudflare setup |
| Embedding generation for products | Feature-level | Requires products in Shopify |
| Test suite | TDD infra | Deferred until code stabilizes |

**Reason for tight scope:** scaffold = structure, plumbing, verification — not features. 35-file scaffold already covers Day 1–2 of the Blueprint. Features ship in later phases, each with its own brainstorm/plan/implement cycle.

---

## Architecture Reference

This scaffold implements the architecture defined in:

- `/Users/partharora/GLASSSKINCARE /Blueprint/MASTER_BLUEPRINT.md` (v2.0)
- `/Users/partharora/GLASSSKINCARE /Blueprint/FINAL_PATCHES_V3.md` (security + reliability patches)
- `/Users/partharora/GLASSSKINCARE /Blueprint/DATABASE_SCHEMA.md` (AI data only — no commerce tables)
- `/Users/partharora/GLASSSKINCARE /Blueprint/CLAUDE_CODE_WORKFLOW.md` (dev environment)

Key design principles (from Blueprint):

- Shopify owns commerce (products, cart, checkout, orders). FastAPI owns AI.
- Hydrogen fetches products from Shopify Storefront API — never from FastAPI DB.
- pgvector dimension = 768 (sentence-transformers `all-MiniLM-L6-v2`). OpenAI embeddings removed in P2 fix.
- uvloop removed from requirements (Windows incompatibility, FINAL_PATCHES_V3 Fix 1).
- Auth: Shopify Customer Accounts for consumers; FastAPI JWT for admin only.

---

## Environment Variables

`backend/.env` (loaded by Pydantic settings):

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/glass_skincare
REDIS_URL=redis://localhost:6379/0
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000
ANTHROPIC_API_KEY=sk-ant-...
SECRET_KEY=<64-char-random>
SHOPIFY_STORE_DOMAIN=___.myshopify.com
SHOPIFY_ADMIN_API_TOKEN=shpat_...
SHOPIFY_WEBHOOK_SECRET=<from webhook config>
R2_ACCOUNT_ID=<later>
R2_ACCESS_KEY_ID=<later>
R2_SECRET_ACCESS_KEY=<later>
R2_BUCKET_NAME=glass-skincare-assets
R2_PUBLIC_URL=https://assets.glassskincare.co
AI_CHALLENGE_SECRET=<32-char-random>
```

`hydrogen/.env`:

```
SESSION_SECRET=<64-char-random>
PUBLIC_STORE_DOMAIN=___.myshopify.com
PUBLIC_STOREFRONT_API_TOKEN=<shpat-like-storefront-token>
PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID=<from Hydrogen link>
PUBLIC_CUSTOMER_ACCOUNT_API_URL=https://shopify.com/<region>/account/customer/api/2024-01/graphql
SHOP_ID=<numeric>
FASTAPI_URL=http://localhost:8000
PUBLIC_R2_URL=https://assets.glassskincare.co
```

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Shopify CLI browser login requires Chrome | Document fallback to API token-only mode |
| pgvector requires custom Postgres build | Use `pgvector/pgvector:pg16` Docker image (prebuilt) |
| sentence-transformers download slow on first run | Cache in `~/.cache/huggingface`; rerun safe |
| uvloop install fails on macOS | Already removed from requirements per FINAL_PATCHES_V3 Fix 1 |
| Hydrogen link fails without populated `.env` | Walk user through `cp .env.example .env` first |
| Docker Desktop not running on Mac | Check `docker info` before any compose command |

---

## Acceptance

This design is approved when:

- All 5 sections above approved by user (DONE)
- Spec file written to disk (DONE — this file)
- Spec committed to git (next step)
- User reviews the written spec for any final changes

After acceptance, invoke `superpowers:writing-plans` to create the implementation plan from this spec.