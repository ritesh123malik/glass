# BACKEND API REFERENCE
### FastAPI AI Engine — /ai/* and /admin/* endpoints only
### v2.0: Commerce endpoints (cart, checkout, orders, products CRUD) removed — handled by Shopify.

Base URL: https://api.glassskincare.co
All responses are JSON. AI endpoints are rate limited by IP + global ceiling.
Admin endpoints require: `Authorization: Bearer <admin_jwt_token>`

> **What's NOT here anymore:**
> - `/cart/*` → Use Shopify Storefront API Cart mutations from Hydrogen
> - `/checkout/*` → Shopify Checkout URL (Hydrogen redirects natively)
> - `/orders/*` → Shopify Admin API / Storefront API
> - `/products` CRUD → Shopify Admin API (manage in Shopify dashboard)
> - `/auth/register`, `/auth/login` → Shopify Customer Accounts

---

## AUTH ENDPOINTS (Admin AI Bar Only)

These endpoints authenticate your admin access to the AI command bar.
Consumer authentication is handled entirely by Shopify Customer Accounts.

### POST /auth/admin-login
```
Body: { email, password }
Response: { access_token, token_type: "bearer" }
Action: Verifies admin credentials against users table (is_admin = true)
Rate limit: 5/minute
Note: Only admins have accounts in this database. Customers log in via Shopify.
```

### GET /auth/verify-shopify-token
```
Body: { shopify_customer_access_token: str }
Action: Verifies the Shopify customer token with Shopify Storefront API
        Creates or updates the user row in your users table
        Returns your internal user_id + whether skin profile exists
Response: { user_id, has_skin_profile: bool, skin_type: str? }
Used by: Hydrogen after Shopify login, to check if AI profile exists
```

---

## AI ENDPOINTS

### GET /ai/session-token
```
Auth: Not required
Response: { token: str, expires_in: 900 }
Purpose: Anonymous challenge token for unauthenticated AI chat access
Hydrogen fetches this on page load. Protects against raw HTTP bots.
```

### POST /ai/chat
```
Auth: Not required (rate limited by IP + global ceiling)
Headers: X-AI-Session-Token (required for anonymous users, skip if sending Shopify customer token)
Body: {
  messages: [{ role: "user"|"assistant", content: str }],
  shopify_customer_token?: str   ← if logged in via Shopify
}
Response: Server-Sent Events (SSE stream)
  data: {"text": "chunk"}\n\n
  data: [DONE]\n\n
Rate limit: 20/minute per IP, 500/hour global ceiling
Side effect: Saves conversation to ai_conversations table if customer token provided
```

### POST /ai/analyze-skin
```
Auth: Not required (rate limited)
Body: { image_base64: str, media_type: "image/jpeg"|"image/png", shopify_customer_token?: str }
Response: {
  analysis: { skin_type, concerns, concern_details, overall_skin_health, confidence },
  recommended_handles: ["vitamin-c-serum", "oil-control-toner"]  ← Shopify product handles
}
Rate limit: 5/minute
Side effect: Saves analysis + updates skin_profile if customer token provided
Note: Hydrogen uses the returned handles to fetch live price+stock from Shopify Storefront API
```

### POST /ai/skin-quiz
```
Auth: Optional (send shopify_customer_token to save profile)
Body: {
  answers: {
    skin_type: str,
    primary_concern: str,
    current_routine: str,
    lifestyle: str,
    budget: str
  },
  shopify_customer_token?: str
}
Response: {
  skin_profile_summary: str,
  morning_routine: [{ step, shopify_handle, product_name, action, how_to_use, why }],
  evening_routine: [same structure],
  routine_goal: str
}
Side effect: Saves skin_profile + generates skin_embedding for future recommendations
```

### POST /ai/recommend
```
Auth: Required (send shopify_customer_token)
Body: { shopify_customer_token: str }
Response: { recommended_handles: ["handle-1", "handle-2", ...] }  ← top 5 Shopify product handles
Uses: pgvector cosine similarity on skin_embedding
Fallback: Returns handles of top 5 products in product_embeddings if no skin profile
Note: Hydrogen fetches live Shopify data for each handle separately
```

---

## ADMIN ENDPOINTS (all require Admin JWT)

These endpoints allow the AI command bar to read and act on Shopify data via Admin API.

### GET /admin/dashboard
```
Auth: Admin JWT required
Action: Queries Shopify Admin API for today's stats
Response: {
  today_revenue: float,             ← from Shopify Orders API
  pending_orders: int,              ← from Shopify Orders API (financial_status=pending)
  total_customers: int,             ← from Shopify Customers API
  low_stock_variants: int,          ← from Shopify Inventory API (inventory_quantity < threshold)
  revenue_change_pct: float         ← vs yesterday
}
```

### GET /admin/orders
```
Auth: Admin JWT required
Query params: status, date_from, date_to, search, limit, cursor (Shopify cursor pagination)
Action: Proxies query to Shopify Admin API Orders
Response: { orders: [ShopifyOrderSummary], next_cursor, prev_cursor }
```

### PUT /admin/orders/{shopify_order_id}/status
```
Auth: Admin JWT required
Body: { status: "fulfilled"|"unfulfilled"|"cancelled", tracking_number?: str }
Action: Calls Shopify Admin API to update fulfillment status
        Logs action to admin_actions table
Response: { success: true, shopify_order_id }
```

### POST /admin/orders/{shopify_order_id}/refund
```
Auth: Admin JWT required
Body: { reason?: str, line_items?: [{ line_item_id, quantity, restock: bool }] }
Action: Calls Shopify Refund API, full or partial refund
        Logs to admin_actions table
Response: { refund_id, amount_refunded, currency }
```

### GET /admin/customers
```
Auth: Admin JWT required
Query: search, skin_type (from your skin_profiles), page, limit
Action: Queries Shopify Customers API, enriches with skin_profile data from your DB
Response: [{ shopify_customer_id, email, name, order_count, total_spent, skin_type?, skin_concerns? }]
```

### GET /admin/analytics/revenue
```
Auth: Admin JWT required
Query: days (default 30)
Action: Shopify Admin API → orders grouped by day
Response: [{ date: "2024-01-15", revenue: 12400.00, order_count: 8 }]
```

### GET /admin/analytics/top-products
```
Auth: Admin JWT required
Query: days (default 30), limit (default 10)
Action: Shopify Admin API → orders → aggregate by product
Response: [{ shopify_product_id, handle, name, units_sold, revenue }]
```

### POST /admin/ai-command
```
Auth: Admin JWT required
Body: { command: str }
Response: {
  action: str,              ← whitelisted action name
  description: str,         ← human-readable: "Will refund 12 orders totalling ₹4,800"
  requires_confirmation: bool,
  params: {},
  estimated_impact: str
}
Safety: LLM output passes through whitelist validator before returning to frontend
```

### POST /admin/ai-command/execute
```
Auth: Admin JWT required
Body: { action: str, params: {} }
Response: { success: bool, result: {}, message: str }
Action: Executes the confirmed action via Shopify Admin API, logs to admin_actions
```

---

## SYNC ENDPOINTS (called by Shopify Webhooks)

### POST /sync/product-updated
```
Auth: Shopify HMAC signature verification (not JWT)
Trigger: Shopify webhook: products/update or products/create
Body: Shopify product webhook payload
Action: Regenerates benefit_embedding for this product in product_embeddings table
Response: 200 OK always (to prevent Shopify retries on internal errors)
```

### POST /sync/order-paid
```
Auth: Shopify HMAC signature verification
Trigger: Shopify webhook: orders/paid
Body: Shopify order webhook payload
Action: Checks if customer has a skin profile → triggers AI post-purchase recommendation email
Response: 200 OK always
```

---

## ERROR RESPONSES

All errors follow this format:
```json
{
  "detail": "Human-readable error message"
}
```

HTTP Status codes used:
- 200: Success
- 201: Created
- 400: Bad request
- 401: Not authenticated
- 403: Authenticated but not authorized
- 404: Resource not found
- 422: Validation error (Pydantic)
- 429: Rate limit exceeded
- 500: Internal server error
