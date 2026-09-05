# Glass Skincare — Claude Code Context

## Project
AI-powered skincare e-commerce platform. Two domains: glassskincare.co (international) + glassskincare.in (India).

## Stack
- **Frontend:** Shopify Hydrogen 2.x (Remix/Vite) on Shopify Oxygen (edge)
- **Backend:** FastAPI 0.115 (Python 3.11) on local Mac / Windows Server in prod
- **DB:** PostgreSQL 16 + pgvector (Docker locally; native on Windows Server prod)
- **Cache:** Redis 7 (Docker locally; WSL2 on Windows Server prod)
- **AI:** Anthropic Claude Sonnet 4 (chat, vision), sentence-transformers all-MiniLM-L6-v2 (embeddings, 384-dim)
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
8. pgvector dimension = 384 (sentence-transformers all-MiniLM-L6-v2, not OpenAI 1536).

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
