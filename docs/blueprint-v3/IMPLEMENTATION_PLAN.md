# IMPLEMENTATION PLAN
### Glass Skincare — 7-Week Execution Plan (Hydrogen + Oxygen Edition)
### v2.0: Shopify handles commerce. You build AI + 3D. Time to launch cut from 10 weeks → 7 weeks.
### Read this every morning. Cross off tasks as you complete them.

---

## BEFORE YOU START — ENVIRONMENT CHECKLIST

Complete these before writing a single line of code:

- [ ] Claude Code installed and authenticated
- [ ] All 6 MCP servers installed and verified (`claude mcp list`)
- [ ] CLAUDE.md created at project root
- [ ] Shopify Partner account created (partners.shopify.com — free)
- [ ] Shopify development store created
- [ ] Shopify CLI installed: `npm install -g @shopify/cli`
- [ ] PostgreSQL running on Windows Server
- [ ] pgvector extension installed (`CREATE EXTENSION vector;` in pgAdmin)
- [ ] Redis installed and running (`redis-cli ping` returns PONG)
- [ ] Node.js 20+ installed (`node --version`)
- [ ] Python 3.11+ installed (`python --version`)
- [ ] Git initialized, GitHub repo created
- [ ] Cloudflare account created, both domains added, nameservers updated
- [ ] Anthropic API key copied to backend `.env`
- [ ] Cloudflare R2 bucket created, access keys copied to backend `.env`

> **NOT needed anymore (Shopify handles it):**
> ~~Stripe account~~ · ~~Stripe webhook setup~~ · ~~Custom checkout~~ · ~~Product database~~

---

## PHASE 1 — SHOPIFY STORE + AI BACKEND FOUNDATION (Week 1–2)
**Goal: Shopify store live with real products. FastAPI running with auth and database. No 3D yet.**

### Day 1 — Shopify Store Setup
- [ ] Create Hydrogen app: `npm create @shopify/hydrogen@latest`
- [ ] Select: TypeScript, Tailwind, Hydrogen storefront — install into `./hydrogen`
- [ ] Login Shopify CLI: `cd hydrogen && npx shopify login`
- [ ] Link to your dev store: `npx shopify hydrogen link`
- [ ] Verify `.env` is populated with your store domain + Storefront API token
- [ ] Run locally: `npm run dev` → verify products load from Shopify
- [ ] Push to GitHub: create repo `glass-skincare`, commit

**Claude Code prompt for Day 1:**
```
I have a fresh Shopify Hydrogen app scaffolded in the hydrogen/ folder.
The .env file is already configured with my Shopify store credentials.

Please verify the app works by:
1. Reading hydrogen/app/routes/_index.tsx — the homepage
2. Checking that it uses context.storefront to fetch products from Shopify
3. If it uses demo/mock data instead of live Shopify data, update it to use the Storefront API

The app should fetch featured products from Shopify Storefront API on the homepage.
Show me what the current route file contains.
```

### Day 2 — Add Products to Shopify
- [ ] In Shopify Admin → Products → Add all your Glass Skincare products
- [ ] For each product, add metafields (Shopify Admin → Settings → Custom data → Products):
  - Namespace: `skincare`, Key: `skin_types` (list of text: oily, dry, combination, normal, sensitive)
  - Namespace: `skincare`, Key: `concerns` (list of text: acne, pigmentation, aging, dryness)
  - Namespace: `skincare`, Key: `ingredients` (text: short ingredient summary)
- [ ] Add product images, prices, inventory quantities
- [ ] Assign products to collections (Serums, Moisturisers, Sunscreen, etc.)
- [ ] Verify all products appear at `localhost:3000/products`

### Day 3 — FastAPI AI Backend Setup
- [ ] Create folder: `mkdir -p backend/app/{models,schemas,routers,services,middleware}`
- [ ] Create `backend/app/main.py` — FastAPI entry point
- [ ] Create `backend/app/config.py` — reads all settings from .env
- [ ] Create `backend/app/database.py` — PostgreSQL + SQLAlchemy async engine
- [ ] Create `backend/requirements.txt`
- [ ] Install deps: `pip install -r backend/requirements.txt`

**Claude Code prompt for Day 3:**
```
Create the initial FastAPI project structure in the backend/ folder.

backend/app/main.py:
- FastAPI app with CORS middleware allowing glassskincare.co, glassskincare.in, localhost:3000
- Health check endpoint GET /health returning {"status": "ok"}
- Include routers for: ai, admin, auth, sync
- Lifespan handler that connects to database on startup

backend/app/config.py:
- Uses pydantic-settings to read from .env
- Settings: DATABASE_URL, SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_DAYS,
  ANTHROPIC_API_KEY, SHOPIFY_ADMIN_API_TOKEN, SHOPIFY_STORE_DOMAIN, SHOPIFY_WEBHOOK_SECRET,
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL,
  REDIS_URL, ENVIRONMENT, ALLOWED_ORIGINS, AI_CHALLENGE_SECRET

backend/requirements.txt:
fastapi, uvicorn, sqlalchemy[asyncio], asyncpg, alembic, pydantic, pydantic-settings,
python-jose, passlib, bcrypt, anthropic, boto3, redis, python-multipart, pgvector, httpx
```

### Day 4 — Database Models + Migrations
- [ ] Initialize Alembic: `cd backend && alembic init migrations`
- [ ] Create SQLAlchemy models: user.py, skin_profile.py, product_embedding.py, ai_conversation.py, admin_actions.py
- [ ] Run first migration: `alembic revision --autogenerate -m "initial ai tables"`
- [ ] Apply: `alembic upgrade head`
- [ ] Verify tables in pgAdmin

**Claude Code prompt for Day 4:**
```
Read DATABASE_SCHEMA.md and create all SQLAlchemy models in backend/app/models/.
Create separate files: user.py, skin_profile.py, product_embedding.py, ai_conversation.py, admin_actions.py

Key points from the schema:
- users table has shopify_customer_id (no password_hash — auth is Shopify's job)
- product_embeddings maps shopify_product_id → benefit_embedding vector(1536)
- No orders, cart, or product CRUD tables — those live in Shopify

Use SQLAlchemy 2.0 style with mapped_column and Mapped type hints.
After creating models, configure alembic.ini to use DATABASE_URL from config.py.
Generate and apply the migration.
```

### Day 5 — Admin Auth + Shopify Product Sync
- [ ] Create `/auth/admin-login` endpoint with JWT
- [ ] Create `scripts/sync_shopify_catalog.py` — pulls Shopify products, generates embeddings, inserts to product_embeddings
- [ ] Run sync script: `python scripts/sync_shopify_catalog.py`
- [ ] Verify product_embeddings table populated in pgAdmin

### Day 6–7 — Shopify Webhook Handler (Sync)
- [ ] Create `backend/app/routers/sync.py`
- [ ] POST /sync/product-updated — verifies Shopify HMAC, triggers re-embedding
- [ ] POST /sync/order-paid — logs event, triggers AI follow-up if skin profile exists
- [ ] Register webhooks in Shopify Admin → Settings → Notifications

---

## PHASE 2 — HYDROGEN FRONTEND (Week 3–4)
**Goal: A real, working Hydrogen storefront. Products, collections, cart, checkout all work natively.**

### Day 8–9 — Product Pages
- [ ] Update `hydrogen/app/routes/products.$handle.tsx` — product detail page
- [ ] Add image gallery with variant selector
- [ ] Add to Cart button using Shopify CartForm
- [ ] Update `hydrogen/app/routes/products._index.tsx` — product listing
- [ ] Add filter bar (skin type, category — filter against Shopify collection handles)

**Claude Code prompt for Product Pages:**
```
Update the Hydrogen product detail page at hydrogen/app/routes/products.$handle.tsx

Requirements:
- Fetch product data using Shopify Storefront API (context.storefront.query with PRODUCT_QUERY)
- Show: main image, image gallery thumbnails, product title, price, short_description
- Add variant selector (size/variant options if any)
- Add to Cart button using Shopify CartForm with action="lines-add"
- Show "Only X left" if inventory_quantity < 5
- Show skincare.skin_types and skincare.concerns metafields as badge pills
- Keep slot for 3D viewer (ProductViewer.client.tsx) — add in Phase 4

Storefront API query should fetch: id, title, handle, description, priceRange, images(first:6),
variants(first:10), metafields for skin_types/concerns
```

### Day 10 — Cart + Checkout
- [ ] Cart is already handled by Hydrogen CartForm — verify it works
- [ ] Customize `hydrogen/app/components/consumer/CartDrawer.tsx` — slide-in cart sidebar
- [ ] Test full checkout flow: add product → cart → Shopify checkout → Shop Pay
- [ ] Verify: Indian card test, UPI test (use Shopify test credentials)

### Day 11–12 — Homepage Layout
- [ ] Build homepage structure (`_index.tsx`): hero slot + featured products + testimonials + AI quiz CTA
- [ ] Hero section: placeholder div (3D added in Phase 4)
- [ ] Featured products: fetch from Shopify collection "featured" via Storefront API
- [ ] AI Quiz CTA: "Discover your skin routine" button → links to `/skin-quiz`
- [ ] Build `Header.tsx` with cart count badge (from Shopify cart hook)
- [ ] Build `Footer.tsx`

### Day 13–14 — Collections + Search
- [ ] `collections.$handle.tsx` — renders collection product grid
- [ ] Add sort + filter using Shopify Storefront API search/filter params
- [ ] Build skin type filter chips (oily, dry, combination) that filter by metafield
- [ ] Deploy first preview to Oxygen: `npx shopify hydrogen deploy`
- [ ] Test on mobile + verify both domains route correctly

---

## PHASE 3 — AI FEATURES (Week 5)
**Goal: Dr. Glow AI dermatologist live. Skin quiz live. Photo analysis live.**

### Day 15–16 — AI Service + Dermatologist Chat
- [ ] Create `backend/app/services/ai_service.py` — Claude streaming wrapper
- [ ] Create `backend/app/routers/ai.py`:
  - GET /ai/session-token
  - POST /ai/chat (streaming SSE)
  - POST /ai/analyze-skin
  - POST /ai/skin-quiz
  - POST /ai/recommend
- [ ] Test with curl: `curl -X POST https://api.glassskincare.co/ai/chat -d '{"messages": [...]}'`
- [ ] Verify streaming works through Nginx

**See AI_INTEGRATION.md for exact system prompts, Claude API call patterns, and skin analysis JSON format.**

### Day 17 — Hydrogen AI Chat Route
- [ ] Create `hydrogen/app/routes/api/ai-chat.ts` — Hydrogen edge route that proxies SSE to FastAPI
- [ ] Build `DermatologistChat.tsx` floating widget
- [ ] Connect widget to `/api/ai-chat` route (never call FastAPI directly from browser — always proxy through Hydrogen)
- [ ] Test chat on product page: "I have oily skin and acne, what should I use?"
- [ ] Verify Dr. Glow recommends products that exist in your Shopify store

**Claude Code prompt for AI Chat:**
```
Create hydrogen/app/routes/api/ai-chat.ts — a Hydrogen server action that proxies to FastAPI.

export async function action({ request, context }: ActionFunctionArgs) {
  const body = await request.json();
  const fastapiUrl = `${context.env.FASTAPI_URL}/ai/chat`;

  // Fetch from FastAPI with SSE
  const response = await fetch(fastapiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-AI-Session-Token": body.sessionToken || "",
    },
    body: JSON.stringify({ messages: body.messages }),
  });

  // Return streaming response directly to browser
  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}

Then create components/consumer/DermatologistChat.tsx:
- Floating chat bubble in bottom-right corner
- Expands to a chat window on click
- Sends messages to /api/ai-chat action
- Streams tokens as they arrive using EventSource or fetch with ReadableStream
- When AI recommends a product, show a ProductCard mini-component with "Add to Cart" button
- Add to cart calls Shopify CartForm — not your FastAPI
```

### Day 18 — Skin Quiz
- [ ] Build `hydrogen/app/routes/skin-quiz.tsx` — 5-step quiz page
- [ ] Quiz questions: skin type, primary concern, lifestyle, budget, current routine
- [ ] POST quiz answers to FastAPI `/ai/skin-quiz` → returns routine JSON with shopify_handles
- [ ] Hydrogen fetches Shopify product data for each returned handle
- [ ] Show morning + evening routine with "Add all to cart" button (Shopify CartForm bulk add)

### Day 19–20 — Skin Photo Analysis + pgvector Recommendations
- [ ] Add image upload to DermatologistChat widget
- [ ] POST to FastAPI `/ai/analyze-skin` with base64 image
- [ ] Display analysis results with AI-matched product cards
- [ ] POST /ai/recommend: returns handles → Hydrogen fetches live Shopify data
- [ ] Show "Your recommended routine" section on homepage if skin profile exists
- [ ] Test: full flow from photo upload → analysis → recommendations → add to cart

---

## PHASE 4 — 3D + DESIGN LAYER (Week 6)
**Goal: Transform the functional shop into the revolutionary experience.**

### Day 21 — 3D Setup in Hydrogen
- [ ] Install R3F (already done in Phase 1): verify `three`, `@react-three/fiber`, `@react-three/drei` installed
- [ ] Confirm Vite config in Hydrogen supports dynamic imports (it does by default)
- [ ] Place .glb product models in `hydrogen/public/models/`

**Critical Hydrogen/Oxygen rule for 3D:**
```
All Three.js / React Three Fiber components MUST:
1. Have the .client.tsx suffix
2. Be imported with dynamic import + ssr: false OR wrapped in <ClientOnly>

Oxygen is an edge runtime (like Cloudflare Workers). WebGL does NOT exist server-side.
Attempting to import Three.js in a server component crashes the Oxygen deployment.
```

```typescript
// ✅ CORRECT — dynamic import in hydrogen/app/routes/_index.tsx
import { Suspense, lazy } from "react";
const HeroScene = lazy(() => import("~/components/3d/HeroScene.client"));

// In your JSX:
<Suspense fallback={<div className="h-screen bg-black" />}>
  <HeroScene />
</Suspense>
```

### Day 22 — Hero 3D Scene
- [ ] Create `HeroScene.client.tsx` (see MASTER_BLUEPRINT.md for full spec)
- [ ] R3F Canvas: fullscreen, transparent background
- [ ] Floating product model with breathing animation
- [ ] Particle field background
- [ ] GSAP ScrollTrigger: product shifts to right as user scrolls
- [ ] Lenis smooth scroll initialized in `root.tsx`

### Day 23 — Product 360° Viewer
- [ ] Create `ProductViewer.client.tsx`
- [ ] Replace image gallery on product detail page (on desktop)
- [ ] OrbitControls (limited vertical rotation, auto-rotate off on user drag)
- [ ] Fallback to image gallery if WebGL not supported (`gl.capabilities.isWebGL2` check)

### Day 24–25 — Design System Polish
- [ ] Google Fonts: Cormorant Garamond (headings) + Inter (body) in `root.tsx`
- [ ] Update `tailwind.config.ts` with custom Glass Skincare color palette
- [ ] Apply consistent design system: spacing, typography, color across all pages
- [ ] Add Framer Motion page transitions
- [ ] Mobile check: ensure 3D degrades gracefully on low-power devices
- [ ] Deploy to Oxygen: `git push origin main`
- [ ] Review Lighthouse score — target > 85 mobile

---

## PHASE 5 — ADMIN PORTAL (Week 6, continued)
**Goal: AI Command Bar connected to Shopify Admin API. Full business visibility.**

### Day 26–27 — Admin API Endpoints
- [ ] Create `backend/app/routers/admin.py` — all /admin/* endpoints
- [ ] GET /admin/dashboard → queries Shopify Admin API for live metrics
- [ ] GET /admin/orders → proxies Shopify Orders API with filtering
- [ ] PUT /admin/orders/{id}/status → Shopify fulfillment API
- [ ] POST /admin/orders/{id}/refund → Shopify refund API
- [ ] GET /admin/customers → Shopify Customers API + enriched with your skin_profiles
- [ ] GET /admin/analytics/* → Shopify Analytics via Admin API

**Claude Code prompt for Admin:**
```
Create backend/app/routers/admin.py.

All endpoints require the get_current_admin dependency (checks is_admin=True in JWT).
All Shopify Admin API calls use settings.SHOPIFY_ADMIN_API_TOKEN + settings.SHOPIFY_STORE_DOMAIN.
Use httpx.AsyncClient() for all Shopify API calls.

Shopify Admin GraphQL endpoint: https://{SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/graphql.json

Implement:
- GET /admin/dashboard → run a Shopify GraphQL query for today's orders count, revenue, customer count
- GET /admin/orders → accepts status/date_from/date_to query params, proxies to Shopify Orders API
- PUT /admin/orders/{shopify_order_id}/status → creates fulfillment via Shopify GraphQL
- POST /admin/orders/{shopify_order_id}/refund → creates refund via Shopify GraphQL
- GET /admin/customers → Shopify customers list, join with your skin_profiles table for skin_type data
```

### Day 28 — AI Command Bar
- [ ] Create `POST /admin/ai-command` with whitelist validation (see ARCHITECTURE_PATCHES.md — logic is identical)
- [ ] Create `POST /admin/ai-command/execute` — executes action via Shopify Admin API
- [ ] Build `AICommandBar.tsx` in Hydrogen (admin section, only accessible at /admin)
- [ ] Add `/admin` route to Hydrogen with authentication check
- [ ] Test: "show pending orders", "refund order GLS1234", "export customers to CSV"

---

## PHASE 6 — DEPLOYMENT + LAUNCH (Week 7)
**Goal: Both domains live. SSL. Monitoring. First real sale.**

### Day 29 — Oxygen Production Deploy

```bash
cd hydrogen

# Link to your production store (upgrade from dev store first)
npx shopify hydrogen link  # select production store

# Deploy to production Oxygen
npx shopify hydrogen deploy --env production

# Add custom domains in Shopify Admin → Online Store → Domains
# Add: glassskincare.co and glassskincare.in
```

Update Cloudflare DNS for both domains:
- CNAME @ → shops.myshopify.com (grey — no proxy for Oxygen)
- A api → YOUR_SERVER_IP (orange — Cloudflare proxies FastAPI)

### Day 30 — Backend Production Deploy

```powershell
# On Windows Server:
git clone https://github.com/youruser/glass-skincare.git C:\apps\glass-skincare
cd C:\apps\glass-skincare\backend
pip install -r requirements.txt
alembic upgrade head
pm2 start C:\apps\glass-skincare\ecosystem.config.js
pm2 save && pm2 startup
```

### Day 31 — Shopify Webhooks Registration

In Shopify Admin → Settings → Notifications → Webhooks:
- [ ] Add: products/update → https://api.glassskincare.co/sync/product-updated
- [ ] Add: orders/paid → https://api.glassskincare.co/sync/order-paid
- [ ] Copy signing secret → update backend `.env` → `pm2 restart glass-ai-api`

### Day 32 — Security Audit

**Complete PORTALS_AND_SECURITY.md**
- [ ] Rate limiting on all AI endpoints (Redis-based)
- [ ] CORS locked to your domains only
- [ ] Shopify webhook HMAC verification working on both /sync endpoints
- [ ] AI challenge token working for anonymous chat users
- [ ] Admin JWT required on all /admin/* endpoints
- [ ] Cloudflare WAF enabled for api.glassskincare.co

### Day 33 — Performance

- [ ] 3D model files compressed with gltfpack (target < 2MB per model)
- [ ] Product images served from Cloudflare CDN (Shopify CDN handles this automatically)
- [ ] API response caching with Redis for /ai/recommend (cache per user_id, TTL 1 hour)
- [ ] Lighthouse score > 85 on mobile
- [ ] Test Oxygen edge performance: check response times from India + international

### Day 34 — Monitoring

- [ ] UptimeRobot (free) → ping https://glassskincare.co every 5 min
- [ ] UptimeRobot → ping https://api.glassskincare.co/health every 5 min
- [ ] Configure alert to your phone if either goes down
- [ ] PM2 monitoring: `pm2 monit` for FastAPI server
- [ ] Shopify Analytics → verify order tracking working

### Day 35 — GO LIVE
- [ ] Switch Shopify Payments from test mode to live mode
- [ ] Add real .glb product models
- [ ] Test one real purchase end to end
- [ ] Run catalog sync: `python scripts/sync_shopify_catalog.py`
- [ ] Verify AI recommendations working with real products
- [ ] Announce on Instagram/social
- [ ] Monitor Shopify Admin for first orders

---

## DAILY CHECKLIST (after launch)

```
Morning (5 min):
- [ ] Open Shopify Admin → Orders — process pending orders
- [ ] Check low stock alerts in Shopify Admin → Products
- [ ] Check overnight revenue in Shopify Analytics

Weekly (30 min):
- [ ] Review Shopify Analytics — top products, traffic, conversion rate
- [ ] Check AI consultation stats in your ai_conversations table
- [ ] Run catalog sync if you added new products: python scripts/sync_shopify_catalog.py
- [ ] Verify automated DB backup ran
- [ ] Check pm2 monit for memory usage on FastAPI server
```

---

## WHEN SOMETHING BREAKS

| Symptom | First check | Fix |
|---|---|---|
| Storefront not loading | Shopify Status (status.shopify.com) | Shopify incident — wait |
| Oxygen deploy failed | Shopify Admin → Hydrogen → Deployments | Fix build error in hydrogen/, push again |
| AI chat not streaming | `pm2 logs glass-ai-api` | Check Anthropic API key, check Redis |
| Products not showing | Shopify Admin → Sales Channels → Online Store → is Hydrogen channel enabled? | Enable channel, republish |
| Recommendations wrong | Check product_embeddings table populated | Re-run sync_shopify_catalog.py |
| Cart not working | Shopify Storefront API token valid? | Regenerate in Shopify Admin |
| 502 on api subdomain | `pm2 status` — is glass-ai-api running? | `pm2 restart glass-ai-api` |
