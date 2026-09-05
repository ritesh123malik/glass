# SECURITY CHECKLIST
### Glass Skincare — Complete Security Layer

---

## BACKEND SECURITY

### Rate Limiting (backend/app/middleware/rate_limit.py)
```python
import redis.asyncio as redis
from fastapi import Request, HTTPException
from app.config import settings

r = redis.from_url(settings.REDIS_URL)

async def rate_limit(request: Request, max_calls: int, window_seconds: int):
    ip = request.client.host
    key = f"rate:{ip}:{request.url.path}"
    calls = await r.incr(key)
    if calls == 1:
        await r.expire(key, window_seconds)
    if calls > max_calls:
        raise HTTPException(status_code=429, detail="Too many requests. Slow down.")

# Apply in routers:
# @router.post("/auth/login")
# async def login(request: Request, ...):
#     await rate_limit(request, max_calls=5, window_seconds=60)  # 5 attempts per minute
```

### Rate Limits Per Endpoint
| Endpoint | Limit | Window |
|---|---|---|
| POST /auth/login | 5 | 60 seconds |
| POST /auth/register | 3 | 60 seconds |
| POST /ai/chat | 20 | 60 seconds |
| POST /ai/analyze-skin | 5 | 60 seconds |
| POST /checkout/create-session | 10 | 60 seconds |
| GET /products | 100 | 60 seconds |
| All admin endpoints | 60 | 60 seconds |

### CORS (in main.py)
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),  # from .env
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

### JWT Security
- Tokens expire after 30 days
- Secret key is 64+ random characters
- Admin flag in JWT is verified server-side — never trust client-sent admin flags
- On password change, invalidate all existing tokens (store token version in DB)

### Input Validation
Pydantic validates all inputs automatically. Extra rules to add:
```python
class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    price: float = Field(gt=0, le=100000)
    stock_quantity: int = Field(ge=0)
    sku: str = Field(pattern=r'^[A-Z0-9\-]+$')  # only uppercase, numbers, hyphens
```

### File Upload Security
```python
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_MODEL_TYPES = {"model/gltf-binary"}  # .glb files
MAX_MODEL_SIZE = 50 * 1024 * 1024  # 50MB

async def validate_upload(file: UploadFile, allowed_types: set, max_size: int):
    if file.content_type not in allowed_types:
        raise HTTPException(400, "File type not allowed")
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(400, "File too large")
    return content
```

### Stripe Webhook Verification
```python
@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid signature")
    
    # Process event...
```

---

## FRONTEND SECURITY

### Admin Route Protection (frontend/middleware.ts)
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  
  if (isAdminRoute && !token) {
    return NextResponse.redirect(new URL('/login?redirect=/admin', request.url))
  }
  
  // Additional: verify token is admin — do this in the admin page layout
  // by calling /api/auth/me and checking is_admin
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*']
}
```

### Security Headers (next.config.ts)
```typescript
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' js.stripe.com",
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
      "font-src 'self' fonts.gstatic.com",
      "img-src 'self' data: blob: assets.glassskincare.co",
      "connect-src 'self' glassskincare.co api.stripe.com",
      "frame-src js.stripe.com",
    ].join('; ')
  },
]

module.exports = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  }
}
```

---

## SECURITY CHECKLIST — BEFORE GO LIVE

### Authentication
- [ ] JWT secret is 64+ random characters (not a word or phrase)
- [ ] Passwords are bcrypt hashed (never stored plain)
- [ ] Admin routes verified to reject non-admin tokens
- [ ] Login rate limited to 5 attempts per minute
- [ ] Password reset uses time-limited tokens (expire after 1 hour)

### API
- [ ] CORS only allows your two domains
- [ ] Rate limiting enabled on all endpoints
- [ ] All inputs validated with Pydantic
- [ ] File uploads restricted to image types only
- [ ] No sensitive data in API responses (no password_hash, no full credit card data)
- [ ] Stripe webhook signature verified on every call

### Database
- [ ] PostgreSQL password is strong (16+ chars, mixed)
- [ ] PostgreSQL only accepts connections from localhost (not exposed to internet)
- [ ] pgAdmin only accessible locally (not publicly exposed)
- [ ] Daily automated backup running and uploading to R2
- [ ] Backup restore tested at least once

### Server
- [ ] Ports 3000 and 8000 blocked from public internet (only Nginx can access them)
- [ ] Port 5432 (PostgreSQL) blocked from public internet
- [ ] Port 6379 (Redis) blocked from public internet
- [ ] Windows Firewall rules in place
- [ ] Server OS updates applied

### Cloudflare
- [ ] SSL mode set to Full
- [ ] Always use HTTPS enabled
- [ ] Bot Fight Mode enabled
- [ ] Firewall rule: rate limit /api/auth/login
- [ ] DDoS protection active (automatic on free plan)

### Stripe
- [ ] Stripe running in LIVE mode (not test)
- [ ] Webhook endpoint verified with correct secret
- [ ] PCI compliance: you never handle card data (Stripe Checkout handles it)

---
---

# ENV_TEMPLATE — ALL ENVIRONMENT VARIABLES

## Backend (.env)
```env
# ─── Database ───
DATABASE_URL=postgresql+asyncpg://postgres:PASSWORD@localhost:5432/glass_skincare

# ─── Security ───
# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=GENERATE_THIS
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_DAYS=30

# ─── Stripe ───
# Get from: dashboard.stripe.com → Developers → API Keys
STRIPE_SECRET_KEY=sk_live_OR_sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_live_OR_pk_test_...
# Get from: dashboard.stripe.com → Webhooks → your endpoint → Signing secret
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=inr

# ─── Anthropic (Claude API) ───
# Get from: console.anthropic.com → API Keys
ANTHROPIC_API_KEY=sk-ant-...

# ─── OpenAI (for embeddings only) ───
# Get from: platform.openai.com → API Keys
OPENAI_API_KEY=sk-...

# ─── Cloudflare R2 (file storage) ───
# Get from: Cloudflare Dashboard → R2 → Manage R2 API Tokens
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret
R2_BUCKET_NAME=glass-skincare-assets
R2_PUBLIC_URL=https://assets.glassskincare.co
R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com

# ─── Redis ───
REDIS_URL=redis://localhost:6379

# ─── Email (Resend for transactional emails) ───
# Get from: resend.com → API Keys (free: 100 emails/day)
RESEND_API_KEY=re_...
EMAIL_FROM=orders@glassskincare.co

# ─── App Config ───
ENVIRONMENT=production
ALLOWED_ORIGINS=https://glassskincare.co,https://www.glassskincare.co,https://glassskincare.in
ADMIN_EMAIL=your@email.com
APP_NAME=Glass Skincare
```

## Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=https://glassskincare.co/api
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_R2_URL=https://assets.glassskincare.co
NEXT_PUBLIC_APP_NAME=Glass Skincare
NEXTAUTH_SECRET=GENERATE_THIS_SEPARATELY
NEXTAUTH_URL=https://glassskincare.co
```

## Development overrides (.env.development)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---
---

# CONSUMER PORTAL SPEC
### Every page, interaction, and design decision

---

## DESIGN SYSTEM

### Colors
```css
:root {
  --glass-cream: #F5F0EB;      /* page background */
  --glass-sand: #E8DDD2;       /* card backgrounds */
  --glass-tan: #C9A98A;        /* accents, borders */
  --glass-brown: #8B7355;      /* secondary text */
  --glass-charcoal: #1A1A1A;   /* primary text */
  --glass-white: #FDFCFB;      /* pure white elements */
}
```

### Typography
```css
/* In globals.css */
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Inter:wght@300;400;500&display=swap');

h1, h2, h3 { font-family: 'Cormorant Garamond', serif; font-weight: 300; letter-spacing: -0.02em; }
body, p, button, input { font-family: 'Inter', sans-serif; font-weight: 300; }
```

---

## PAGE SPECS

### Homepage (/)
```
Sections (top to bottom):
1. HERO — fullscreen
   - Canvas: Three.js scene, transparent background (cream CSS bg shows through)
   - Product model floating in center-right
   - Left side: tagline "Your skin, finally understood." (Cormorant, 72px, charcoal)
   - Sub: "AI-powered skincare, made for Indian skin." (Inter, 16px, brown)
   - CTA button: "Discover your routine →" → goes to /skin-quiz
   - Scroll indicator: thin animated line at bottom center

2. MARQUEE STRIP — "Vitamin C · Hyaluronic Acid · Retinol · Niacinamide · SPF" scrolling
   Background: glass-charcoal, text: glass-cream, slow scroll animation

3. FEATURED PRODUCTS — 3 cards in a row
   Each card: product photo (top), name, short description, price, "Add to cart"
   Hover: card lifts slightly (Framer Motion), product image zooms 105%
   
4. AI SKIN QUIZ CTA — full-width section
   Background: glass-sand
   Headline: "Not sure what your skin needs?" (Cormorant, 52px)
   Sub: "Take our 60-second AI skin quiz."
   Button → /skin-quiz

5. HOW IT WORKS — 3 columns
   Icon + step: "Analyze" → "Personalize" → "Transform"
   
6. TESTIMONIALS — 3 review cards with star ratings
   Real customer reviews (add manually from admin portal)

7. FOOTER
   Links: Products, Skin Quiz, About, Contact, Instagram, Returns Policy, Privacy Policy
```

### Products Page (/products)
```
Layout:
- Left sidebar (240px): filters
- Right main area: product grid

Filters:
- Category (checkboxes): Serums, Moisturisers, Sunscreen, Cleansers, Treatments, Kits
- Skin type (checkboxes): Oily, Dry, Combination, Normal, Sensitive
- Concern (checkboxes): Acne, Pigmentation, Aging, Dryness, Brightening
- Price range: slider ₹0 – ₹5000
- Sort: Newest, Price low-high, Price high-low, Best selling

Product Grid:
- 3 columns desktop, 2 tablet, 1 mobile
- Each card: primary image, name, short desc, price (compare price crossed out if set), add to cart
- Loading: skeleton cards while fetching
- Infinite scroll OR pagination (pagination simpler — use pagination)
- Empty state: "No products match your filters. Try removing some filters."
```

### Product Detail (/products/[slug])
```
Layout: 2 columns — left: visuals, right: info

Left (60%):
- 3D ProductViewer component (if model_url exists)
- Fallback: image gallery with thumbnail strip
- Drag to rotate, scroll to zoom

Right (40%):
- Category breadcrumb
- Product name (Cormorant, 40px)
- Star rating + review count
- Price (large, 28px) | Compare price (crossed out, muted)
- Short description
- "Suitable for:" — skin type pills
- "Addresses:" — concern pills
- Quantity selector (- 1 +)
- "Add to cart" button (full width, charcoal)
- "Ask Dr. Glow" button → opens DermatologistChat with product context
- Divider
- Ingredients list (expandable accordion)
- Full description (expandable accordion)
- Reviews section (below fold)
  - Average rating with stars
  - Individual reviews
  - "Write a review" (if purchased)
```

### Skin Quiz (/skin-quiz)
```
5-step wizard. Full screen each step.
Background: animated gradient shifting cream → sand
Progress bar at top (20% increments)

Step layout:
- Question (Cormorant, 48px, centered)
- Options: large pill buttons (full width, stacked)
- Selected: charcoal bg, cream text
- Unselected: transparent, charcoal border
- "Continue →" button (bottom right)
- Back button (top left)

Final step → loading animation → results page:
- "Your Glass Skin Routine" header
- Morning routine accordion
- Evening routine accordion  
- Product cards with "Add all to cart" button
- Each product: why it was recommended for them
```

### Checkout (/checkout)
```
2 columns:
Left: order summary
- Product list with quantities and prices
- Subtotal, shipping (FREE over ₹999), total
- "Secure checkout" trust badge

Right: form
- Name, phone, email
- Address (line 1, line 2, city, state, pincode)
- "Continue to payment →" button

On button click:
- POST /api/checkout/create-session with form data
- Redirect to Stripe hosted checkout page
- Stripe handles card entry, 3D Secure, UPI, etc.
- On success: redirect to /orders/[id]?success=true
- On cancel: redirect to /checkout with cart intact
```

### Order Tracking (/orders/[id])
```
Success state:
- Large checkmark animation
- "Order confirmed! GLS-2024-0042"
- Estimated delivery: 3-5 business days
- Order summary
- "Continue shopping" button

Tracking state (after shipped):
- Tracking number with courier link
- Status timeline: Ordered → Confirmed → Packed → Shipped → Delivered

Navigation: Customer needs to be logged in.
Guest orders: show order via email link only.
```

---

## DERMATOLOGIST CHAT WIDGET

```
Position: Fixed, bottom-right corner
z-index: 9999 (always on top)

Collapsed state:
- Circular button (56px diameter)
- Background: glass-charcoal
- Icon: sparkle or chat bubble in cream

Expanded state (380px × 520px):
- Header: "Dr. Glow — Glass Skincare" + close button
- Messages area (scrollable)
- Photo upload button (camera icon)
- Text input + send button
- Thinking indicator: 3 pulsing dots while streaming

Message bubbles:
- User: right-aligned, charcoal bg, cream text
- Dr. Glow: left-aligned, sand bg, charcoal text
- Product recommendation cards embedded in messages

Product recommendation card (inside chat):
- Small horizontal card: image | name + price | "Add to cart" button
- Clicking "Add to cart" adds to cart and shows success toast

Mobile: full screen when expanded
```

---
---

# ADMIN PORTAL SPEC
### Your complete business command center

---

## ACCESS + AUTH

URL: glassskincare.co/admin
Access: email + password login → redirected here from /login if is_admin=true
Non-admins who visit /admin: redirected to /login

---

## DASHBOARD (main page)

### Metric Cards (4, top row)
- Today's revenue (₹ total of paid+shipped+delivered orders today)
- Pending orders (count of status=pending or status=paid but not shipped)
- Total customers (count of all users where is_admin=false)
- Low stock alerts (count of products where stock_quantity < low_stock_threshold)

All metrics auto-refresh every 60 seconds (React Query refetch interval).

### Quick Actions (below metrics)
- "View pending orders" → /admin/orders?status=pending
- "Add new product" → /admin/products/new
- "View today's orders" → /admin/orders?date=today

---

## ORDERS PAGE

### AI Command Bar (top)
See AI_INTEGRATION.md for full spec. Quick chips:
- "Pending orders", "Refund yesterday's orders", "Revenue this week"
- "Flag orders over ₹5000", "Export all orders to CSV"
- "Show delivered orders this month", "Mark all paid orders as processing"

### Order Table
Columns: Order #, Customer name, Products (truncated), Amount, Status badge, Created date, Actions

Status badges and colors:
- pending → amber
- paid → blue  
- processing → purple
- shipped → teal
- delivered → green
- refunded → red
- cancelled → gray

Actions per row:
- View full order (modal)
- Update status (dropdown)
- Refund (if paid/shipped — opens confirmation modal)
- Print label (generates a simple shipping label PDF)

### Order Detail Modal
Full details: customer info, shipping address, all items with quantities, payment info, Stripe payment intent link, status timeline, internal notes field.

### Filters
- Status dropdown
- Date range picker
- Search by order number or customer name/email
- Sort by date (desc default)

---

## CUSTOMERS PAGE

### Customer Cards Grid (2-column)
Each card: initials avatar, name, email, city, order count, total spent, avg rating given, skin type pills, last order date.

Click a card → Customer Detail View:
- Full profile
- All orders table
- Skin profile from quiz
- AI consultation history

### Filters
- Search by name or email
- Filter by skin type
- Filter by city/state
- Sort by: Total spent, Order count, Most recent

---

## PRODUCTS PAGE

### Inventory Table
Columns: Thumbnail, Name, SKU, Category, Price, Stock (with color — red if low), Status (Active/Inactive), Actions (Edit, Toggle active, Delete)

Low stock row: red background highlight when stock < threshold

### Add/Edit Product Form
Fields: Name, Slug (auto-generated from name, editable), Category, Short description, Full description, Price, Compare price, SKU, Stock quantity, Low stock threshold, Ingredients (textarea), Skin types (multi-select checkboxes), Concerns (multi-select checkboxes), 3D model upload (.glb), Images upload (multiple, drag to reorder), Featured toggle, Active toggle.

On save: POST /admin/products → if success, re-embed product for AI recommendations.

---

## ANALYTICS PAGE

### Revenue Chart
Line chart: last 30 days daily revenue
Built with Recharts — simple LineChart component
X axis: dates, Y axis: ₹ amount
Tooltip: exact amount on hover

### Top Products (this month)
Horizontal bar chart: products by units sold
Click product → go to product edit page

### Skin Type Breakdown
Pie or horizontal bar chart from skin_profiles table
Shows: what % of customers have each skin type
Helps you understand your market

### AI Consultation Stats
- Total consultations this month
- Conversion rate (consultations that resulted in a cart addition)
- Most common skin concern asked
- Number of skin photos analyzed

### Customer Geography
Table: City, Customer count, Total revenue
Helps you understand where your customers are

---

## ADMIN SETTINGS (future phase — document for later)
- Change admin password
- Update email notification preferences
- Manage shipping rates
- Configure low stock thresholds
- API key management (rotate Stripe/Claude keys without touching .env directly)
