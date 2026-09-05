# GLASS SKINCARE — MASTER BLUEPRINT
### Version 2.0 | Shopify Hydrogen + Oxygen Edition
### Domains: glassskincare.co · glassskincare.in

---

## HOW TO USE THIS BLUEPRINT

This blueprint is a complete, self-contained build guide. You never need to ask anyone anything.
Every file is a standalone reference. Read them in order once, then use them as daily references.

```
READ ORDER (first time):
1. MASTER_BLUEPRINT.md          ← you are here. Read fully first.
2. CLAUDE_CODE_WORKFLOW.md      ← set up your environment before writing a single line of code
3. IMPLEMENTATION_PLAN.md       ← your daily execution guide, phase by phase
4. DATABASE_SCHEMA.md           ← understand your data model (AI + skin profiles only)
5. BACKEND_API.md               ← FastAPI AI endpoints reference
6. AI_INTEGRATION.md            ← Claude API, skin analysis, dermatologist
7. DEPLOYMENT_GUIDE.md          ← Hydrogen → Oxygen + Windows Server for FastAPI backend
8. PORTALS_AND_SECURITY.md      ← protection layer
```

> ⚠️ **ARCHITECTURE NOTE (v2.0)**
> This blueprint has been updated from a custom Next.js + Stripe stack to **Shopify Hydrogen (frontend) + Shopify Oxygen (hosting) + FastAPI (AI engine)**.
> Shopify now handles: products, inventory, cart, checkout, orders, payments, and global edge delivery.
> FastAPI now handles: AI dermatologist, skin photo analysis, skin quiz, pgvector recommendations, and the admin AI command bar.

---

## PROJECT OVERVIEW

**Brand:** Glass Skincare
**Mission:** The first AI-powered skincare e-commerce experience. A customer opens the site and is met with a living, breathing 3D environment — not a product catalogue. They speak to an AI dermatologist. Their skin is analysed. A routine is built for them. They never browse; they are guided.

**Two portals:**
- **Consumer portal** — glassskincare.co / glassskincare.in (Shopify Hydrogen + Oxygen, 3D, AI-powered)
- **Admin portal** — Shopify Admin (product/order/customer management) + your custom AI Command Bar

---

## ARCHITECTURE: HOW THE THREE LAYERS FIT TOGETHER

```
CUSTOMER BROWSER
       │
       ▼
┌─────────────────────────────────────────────────────┐
│          SHOPIFY HYDROGEN (Remix / Vite)             │
│          Deployed to Shopify Oxygen (global edge)    │
│                                                       │
│  • 3D Hero scene (React Three Fiber, client-side)    │
│  • Product pages (fetched from Shopify Storefront API)│
│  • Cart + Checkout (Shopify native — zero custom code)│
│  • AI chat widget (streams from your FastAPI)        │
│  • Skin quiz (POSTs to your FastAPI)                 │
└────────────────┬──────────────────┬──────────────────┘
                 │                  │
    Shopify      │                  │   AI / Skin Data
  Storefront API │                  │   (your custom API)
                 ▼                  ▼
┌──────────────────────┐  ┌──────────────────────────────┐
│   SHOPIFY PLATFORM   │  │   FASTAPI AI ENGINE          │
│                      │  │   (Windows Server, PM2)      │
│  • Product catalog   │  │                              │
│  • Inventory         │  │  • POST /ai/chat (streaming) │
│  • Cart sessions     │  │  • POST /ai/analyze-skin     │
│  • Checkout + Pay    │  │  • POST /ai/skin-quiz        │
│  • Orders            │  │  • POST /ai/recommend        │
│  • Shop Pay / UPI    │  │  • POST /admin/ai-command    │
│  • Shopify Shipping  │  │                              │
│  • Shopify Admin     │  │  PostgreSQL + pgvector:      │
│                      │  │  • skin_profiles             │
│  Shopify Admin API:  │  │  • ai_conversations          │
│  • Sync product IDs  │  │  • product_embeddings        │
│    to your AI DB     │  │  • admin_actions (audit log) │
└──────────────────────┘  └──────────────────────────────┘
```

---

## FINALIZED TECH STACK

### Frontend (Shopify Hydrogen on Oxygen)
| Technology | Purpose | Why |
|---|---|---|
| Shopify Hydrogen 2.x | Frontend framework (Remix-based) | Official Shopify headless framework, Storefront API built-in |
| Shopify Oxygen | Hosting | Global edge runtime, zero infra, auto-deploys from GitHub |
| TypeScript | Language | Catches bugs before runtime |
| Tailwind CSS | Styling | Utility-first, fast to build |
| React Three Fiber | 3D scenes | React wrapper for Three.js |
| Three.js | 3D engine | Industry standard for WebGL |
| Drei | R3F helpers | Camera controls, environment maps, loaders |
| GSAP + ScrollTrigger | Animations | Scroll-driven, timeline animations |
| Lenis | Smooth scroll | Butter-smooth scrolling |
| Framer Motion | UI transitions | Page transitions, microanimations |

### Backend (AI Engine — FastAPI on Windows Server)
| Technology | Purpose | Why |
|---|---|---|
| FastAPI (Python) | AI API server | Handles all AI features, no commerce logic |
| Pydantic v2 | Validation | Request/response validation |
| SQLAlchemy 2.0 | ORM | Database abstraction |
| Alembic | Migrations | Database version control |
| Python-jose | JWT auth | Secure tokens for AI API access |
| Passlib | Password hashing | bcrypt |
| Anthropic Python SDK | AI features | Claude API calls |
| Boto3 | File storage | Cloudflare R2 (3D models, skin photos) |
| Uvicorn | ASGI server | Production-grade ASGI server |

### Commerce (Shopify Platform — managed, no custom code)
| Service | Purpose |
|---|---|
| Shopify Products & Inventory | Source of truth for all product data |
| Shopify Cart & Checkout | Native checkout — PCI compliant, zero custom code |
| Shop Pay | One-click checkout, supports UPI / RuPay (India) |
| Shopify Storefront API | Hydrogen fetches products, collections, cart |
| Shopify Admin API | Sync product IDs to your AI database |
| Shopify Webhooks | Order events → trigger AI follow-up emails |

### Database (on your Windows Server — AI data only)
| Technology | Purpose |
|---|---|
| PostgreSQL 16 | Primary database for AI & skin profile data |
| pgvector extension | AI embeddings, skin profile matching |
| Redis | AI rate limiting, session tokens |

### Infrastructure
| Service | Purpose | Cost |
|---|---|---|
| Shopify Hydrogen (Oxygen) | Frontend hosting (global edge) | Included in Shopify plan |
| Windows Server (yours) | Hosts FastAPI + PostgreSQL | Already paid |
| Cloudflare | SSL, CDN, DNS for your AI API domain | Free |
| Cloudflare R2 | 3D model files, skin photos | Free (10GB) |
| Shopify Payments | All payment processing (cards, UPI, Shop Pay) | Shopify transaction fee |
| Claude API | AI features | ~₹0.80/conversation |

---

## PROJECT DIRECTORY STRUCTURE

```
glass-skincare/
├── hydrogen/                          # Shopify Hydrogen application (deployed to Oxygen)
│   ├── app/
│   │   ├── routes/
│   │   │   ├── _index.tsx            # Homepage / 3D hero
│   │   │   ├── products._index.tsx   # Product listing (Storefront API)
│   │   │   ├── products.$handle.tsx  # Product detail + 3D viewer
│   │   │   ├── cart.tsx              # Cart page (Shopify CartForm)
│   │   │   ├── skin-quiz.tsx         # AI skin consultation quiz
│   │   │   ├── collections.$handle.tsx # Collection pages
│   │   │   └── api/
│   │   │       └── ai-chat.ts        # Edge route: proxies streaming to FastAPI
│   │   ├── components/
│   │   │   ├── 3d/
│   │   │   │   ├── HeroScene.client.tsx    # Main 3D hero (client-only)
│   │   │   │   ├── ProductViewer.client.tsx # 360° product viewer (client-only)
│   │   │   │   ├── ParticleField.client.tsx # Background particles (client-only)
│   │   │   │   └── FloatingProduct.client.tsx
│   │   │   ├── consumer/
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   ├── ProductCard.tsx
│   │   │   │   ├── CartDrawer.tsx         # Shopify CartForm wrapper
│   │   │   │   ├── SkinQuiz.tsx
│   │   │   │   └── DermatologistChat.tsx  # AI chat widget (calls /api/ai-chat)
│   │   │   └── ui/
│   │   │       ├── Button.tsx
│   │   │       ├── Badge.tsx
│   │   │       └── Modal.tsx
│   │   ├── lib/
│   │   │   ├── shopify.ts            # Shopify Storefront API client (from Hydrogen)
│   │   │   ├── ai-client.ts          # Fetch wrapper for your FastAPI AI service
│   │   │   └── utils.ts
│   │   └── root.tsx
│   ├── public/
│   │   └── models/                   # .glb 3D model files (served from Oxygen CDN)
│   ├── storefrontQueries/            # GraphQL queries for Shopify Storefront API
│   │   ├── product.graphql
│   │   ├── collection.graphql
│   │   └── cart.graphql
│   ├── hydrogen.config.ts
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                           # FastAPI AI Engine (unchanged from v1, commerce removed)
│   ├── app/
│   │   ├── main.py                   # FastAPI app entry point
│   │   ├── config.py                 # Settings from env vars
│   │   ├── database.py               # DB connection + session
│   │   ├── models/                   # SQLAlchemy models (AI data only)
│   │   │   ├── __init__.py
│   │   │   ├── user.py               # Stores Shopify Customer ID mapping
│   │   │   ├── skin_profile.py
│   │   │   ├── ai_conversation.py
│   │   │   └── product_embedding.py  # Maps Shopify productId → pgvector embedding
│   │   ├── schemas/
│   │   │   ├── ai.py
│   │   │   └── user.py
│   │   ├── routers/
│   │   │   ├── ai.py                 # /ai/chat, /ai/analyze-skin, /ai/skin-quiz, /ai/recommend
│   │   │   ├── admin.py              # AI command bar endpoints
│   │   │   └── sync.py               # Shopify webhook → sync product embeddings
│   │   ├── services/
│   │   │   ├── ai_service.py         # Claude API wrapper
│   │   │   ├── embedding_service.py  # pgvector embeddings
│   │   │   ├── storage_service.py    # R2 file uploads (skin photos, 3D models)
│   │   │   └── shopify_sync.py       # Reads Shopify Admin API to sync product catalog
│   │   └── middleware/
│   │       ├── auth.py
│   │       └── rate_limit.py
│   ├── migrations/
│   ├── alembic.ini
│   ├── requirements.txt
│   └── .env
│
├── scripts/
│   ├── backup_db.sh
│   └── sync_shopify_catalog.py       # One-shot script: pull Shopify products → generate embeddings
│
└── .gitignore
```

---

## CORE PRINCIPLES — NEVER BREAK THESE

**1. Shopify is the commerce source of truth.**
Products, prices, inventory, cart, and orders all live in Shopify. Your database never stores cart or order data. If a product is out of stock, Shopify enforces it — not your code.

**2. FastAPI is the AI source of truth.**
All Claude API calls go through FastAPI. Hydrogen calls your FastAPI `/ai/*` endpoints. FastAPI never handles payments or inventory.

**3. Hydrogen fetches products from Shopify Storefront API, not your database.**
Product catalog data (name, price, images, stock) comes from Shopify Storefront API via GraphQL. Your `product_embeddings` table only stores the Shopify productId + the pgvector embedding for AI matching.

**4. Every admin AI action that modifies data requires confirmation.**
The AI command bar shows you what it will do. You confirm. Then it runs. No silent destructive operations.

**5. Environment variables for every secret.**
API keys, Shopify tokens, Anthropic keys — never hardcoded. Always in `.env` files that are in `.gitignore`.

**6. Every AI call is wrapped in a service.**
You never call `anthropic.messages.create()` directly in a router. You call `ai_service.get_dermatologist_response()`.

**7. 3D components are always client-only in Hydrogen.**
Suffix 3D components with `.client.tsx` and wrap with `<ClientOnly>` or use dynamic imports. WebGL APIs do not exist in the Oxygen edge runtime (server-side).

---

## PAYMENT FLOW (Shopify Native — Zero Custom Code)

```
Customer clicks "Buy Now"
        ↓
Cart review (Hydrogen CartForm — talks to Shopify Cart API)
        ↓
Hydrogen redirects to Shopify Checkout URL
        ↓
Customer on Shopify Checkout (hosted by Shopify, PCI compliant)
Supports: Shop Pay, UPI, RuPay, Visa, Mastercard, Apple Pay
        ↓
Payment processed by Shopify Payments
        ↓
Shopify fires webhook: orders/paid → your FastAPI /sync/order-paid
        ↓
FastAPI logs the order event, triggers AI follow-up if skin profile exists
        ↓
Customer gets Shopify order confirmation email (automatic)
```

You never handle card data. You never write a single line of checkout code.

---

## AI FEATURES OVERVIEW

```
CONSUMER FEATURES:
├── AI Dermatologist Chat     → FastAPI /ai/chat (Claude streaming) → Shopify product handles
├── Skin Photo Analysis       → FastAPI /ai/analyze-skin (Claude Vision) → recommended Shopify products
├── Skin Quiz Routine Builder → FastAPI /ai/skin-quiz → morning + evening routine → Shopify cart
└── Personalized Homepage     → FastAPI /ai/recommend → returns Shopify productIds → Hydrogen fetches live data

ADMIN FEATURES:
└── AI Command Bar            → FastAPI /admin/ai-command → reads Shopify Admin API → confirms
    Examples:
    "Show refunds this week"              → Shopify Admin API query, read-only, no confirmation
    "Mark order #1042 as shipped"         → Shopify Admin API mutation, shows preview, confirm
    "Refund all pending orders over ₹500" → Shopify refund API, shows count + total, confirm
    "Export customers to CSV"             → Shopify Admin API, generates file, no confirmation
```

---

## DOMAIN STRATEGY

| Domain | Market | Currency | Checkout |
|---|---|---|---|
| glassskincare.co | International + India | INR + USD | Shopify Checkout (Shop Pay, cards) |
| glassskincare.in | India-specific | INR only | Shopify Checkout (UPI, RuPay, Shop Pay) |

Both domains run on the same Hydrogen app deployed to Oxygen.
Hydrogen uses `Localization` context from Shopify to serve the correct market, currency, and language.
No custom multi-domain routing code needed.

---

## FILE SUMMARY

| File | What it is |
|---|---|
| `MASTER_BLUEPRINT.md` | This file. Overview, stack, structure, principles |
| `CLAUDE_CODE_WORKFLOW.md` | How to set up Claude Code, MCPs, daily coding workflow |
| `IMPLEMENTATION_PLAN.md` | Week-by-week execution plan with exact tasks |
| `DATABASE_SCHEMA.md` | AI & skin profile tables only (no commerce tables) |
| `BACKEND_API.md` | FastAPI AI endpoints — all /ai/* and /admin/ai-* routes |
| `AI_INTEGRATION.md` | Claude API setup, prompts, skin analysis |
| `DEPLOYMENT_GUIDE.md` | Hydrogen → Oxygen deploy + Windows Server FastAPI setup |
| `PORTALS_AND_SECURITY.md` | Auth, rate limiting, CORS, CSP |
