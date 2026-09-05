# DEPLOYMENT GUIDE
### Glass Skincare — Hydrogen → Shopify Oxygen (Frontend) + Windows Server (FastAPI AI Backend)
### v2.0: Frontend deploys to Shopify Oxygen with `h2 deploy`. Backend (FastAPI) stays on your server.

---

## ARCHITECTURE OVERVIEW

```
git push → GitHub
    │
    ├─→ Shopify Oxygen CI (auto-detects hydrogen/ folder)
    │       Builds Hydrogen, deploys to global edge in ~2 min
    │       No Nginx. No PM2. No server config for frontend.
    │
    └─→ Your Windows Server (self-managed)
            Runs FastAPI AI engine only
            PM2 + Nginx for /api subdomain
```

**You maintain TWO separate deployments:**
1. `hydrogen/` → GitHub → Shopify Oxygen (zero-touch, automatic)
2. `backend/` → GitHub → Windows Server (git hook auto-deploy, same as before)

---

## PART 1: SHOPIFY HYDROGEN + OXYGEN SETUP

### Step 1: Create a Shopify Partner Account & Store

```
1. Go to partners.shopify.com → Create Partner account (free)
2. Create a Development store:
   Partners Dashboard → Stores → Add store → Development store
   Store name: glass-skincare-dev
3. Later, for production: upgrade to a paid plan and connect glassskincare.co
```

### Step 2: Create a Hydrogen App

```bash
# In your project directory:
npm create @shopify/hydrogen@latest

# Select:
# ✓ Hydrogen storefront (with Shopify data)
# ✓ TypeScript
# ✓ Tailwind CSS
# ✓ Demo products (removes demo data later)
# Directory: ./hydrogen
```

### Step 3: Connect to Your Shopify Store

```bash
cd hydrogen

# Login to Shopify CLI
npx shopify login

# Link to your store
npx shopify hydrogen link
# Select your development store
```

This creates `hydrogen/.env`:
```env
SESSION_SECRET="your_session_secret_here"
PUBLIC_STORE_DOMAIN="glass-skincare-dev.myshopify.com"
PUBLIC_STOREFRONT_API_TOKEN="shpat_..."
PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID="..."
PUBLIC_CUSTOMER_ACCOUNT_API_URL="https://shopify.com/..."
SHOP_ID="..."
```

### Step 4: Add Your FastAPI AI Service URL

Add to `hydrogen/.env`:
```env
# Your FastAPI AI backend (Windows Server)
FASTAPI_URL=https://api.glassskincare.co

# Cloudflare R2 (for 3D models)
PUBLIC_R2_URL=https://assets.glassskincare.co
```

### Step 5: Install Three.js Packages in Hydrogen

```bash
cd hydrogen
npm install three @react-three/fiber @react-three/drei
npm install gsap @gsap/react
npm install lenis
```

### Step 6: Local Development

```bash
cd hydrogen
npm run dev
# Opens http://localhost:3000 — connected to your Shopify dev store
```

### Step 7: Deploy to Shopify Oxygen

```bash
cd hydrogen

# First deploy (creates the Oxygen deployment)
npx shopify hydrogen deploy

# After setup, future deploys happen automatically on git push to main
# Link your GitHub repo in Shopify Admin → Hydrogen → Settings → GitHub
```

After linking GitHub:
- Every `git push origin main` → Oxygen auto-builds and deploys in ~2 minutes
- Preview deployments created on every PR automatically

### Step 8: Connect Your Custom Domains

In Shopify Admin → Online Store → Domains:
```
Add domain: glassskincare.co
Add domain: glassskincare.in
```

Shopify handles SSL automatically for both domains. You do NOT configure Nginx or Cloudflare SSL for the frontend. Shopify Oxygen handles all of it.

Update Cloudflare DNS to point to Shopify:
```
Type   Name   Value                       Proxy
CNAME  @      shops.myshopify.com         ✗ (grey — let Shopify handle SSL)
CNAME  www    shops.myshopify.com         ✗
```

---

## PART 2: FASTAPI AI BACKEND (Windows Server)

The backend is identical in setup to v1, but smaller (no Stripe, no product CRUD, no cart logic).

### Step 1: Install Dependencies on Windows Server

Open PowerShell as Administrator:

```powershell
# Python 3.11
winget install Python.Python.3.11
python --version  # 3.11.x

# PM2
npm install -g pm2
pm2 --version

# Redis (for rate limiting)
# Download from: https://github.com/microsoftarchive/redis/releases
redis-cli ping  # PONG

# Nginx for Windows
# Download from: https://nginx.org/en/download.html
# Extract to C:\nginx\
C:\nginx\nginx.exe -t
```

### Step 2: Database Setup

In pgAdmin:
```sql
CREATE DATABASE glass_skincare;

-- Connect to glass_skincare, then:
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Step 3: Project Directories

```powershell
mkdir C:\apps\glass-skincare\backend
mkdir C:\apps\glass-skincare\logs
mkdir C:\repos
```

### Step 4: Backend Environment File

Create `C:\apps\glass-skincare\backend\.env`:
```env
# Database (AI data only)
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/glass_skincare

# Admin JWT (for AI command bar access)
SECRET_KEY=generate_64_char_random_string_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_DAYS=30

# Anthropic (AI features)
ANTHROPIC_API_KEY=sk-ant-...

# Shopify (for Admin API calls from command bar)
SHOPIFY_ADMIN_API_TOKEN=shpat_...
SHOPIFY_STORE_DOMAIN=glassskincare.myshopify.com
SHOPIFY_WEBHOOK_SECRET=your_shopify_webhook_hmac_secret

# Cloudflare R2 (3D models + skin photos)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret
R2_BUCKET_NAME=glass-skincare-assets
R2_PUBLIC_URL=https://assets.glassskincare.co

# Redis
REDIS_URL=redis://localhost:6379

# App settings
ENVIRONMENT=production
ALLOWED_ORIGINS=https://glassskincare.co,https://glassskincare.in,https://www.glassskincare.co,https://www.glassskincare.in
AI_CHALLENGE_SECRET=random_32_char_string_here
```

### Step 5: Nginx Configuration (AI Backend Only)

The frontend is on Oxygen. Nginx only proxies your FastAPI AI service.

Save as `C:\nginx\conf\conf.d\api-glassskincare.conf`:

```nginx
# api.glassskincare.co — FastAPI AI backend only
server {
    listen 80;
    server_name api.glassskincare.co;

    # Cloudflare handles SSL termination
    client_max_body_size 20M;   # skin photo uploads

    access_log C:/apps/glass-skincare/logs/api-access.log;
    error_log  C:/apps/glass-skincare/logs/api-error.log;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;      # AI streaming can be slow
        proxy_connect_timeout 60;

        # SSE streaming for AI chat — must disable buffering
        proxy_buffering off;
        proxy_cache off;
    }

    location /health {
        proxy_pass http://localhost:8000/health;
        access_log off;
    }
}
```

Add to Cloudflare DNS:
```
Type  Name   Value            Proxy
A     api    YOUR_SERVER_IP   ✓ (orange cloud ON)
```

### Step 6: PM2 Ecosystem File (Backend Only)

Create `C:\apps\glass-skincare\ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'glass-ai-api',
      cwd: 'C:\\apps\\glass-skincare\\backend',
      script: 'uvicorn',
      args: 'app.main:app --host 0.0.0.0 --port 8000 --workers 2',
      interpreter: 'python',
      env: {
        PYTHONPATH: 'C:\\apps\\glass-skincare\\backend',
      },
      max_memory_restart: '512M',
      error_file: 'C:\\apps\\glass-skincare\\logs\\api-error.log',
      out_file:   'C:\\apps\\glass-skincare\\logs\\api-out.log',
      restart_delay: 3000,
    }
  ]
};
```

```powershell
pm2 start C:\apps\glass-skincare\ecosystem.config.js
pm2 save
pm2 startup
```

### Step 7: Auto-Deploy Git Hook (Backend Only)

```powershell
git init --bare C:\repos\glass-skincare-api.git
```

Create `C:\repos\glass-skincare-api.git\hooks\post-receive`:
```bash
#!/bin/bash
echo "=== API Deploy started: $(date) ==="

GIT_WORK_TREE=C:/apps/glass-skincare/backend git checkout -f main

cd C:/apps/glass-skincare/backend
pip install -r requirements.txt --quiet
alembic upgrade head
pm2 restart glass-ai-api --update-env

echo "=== API Deploy complete: $(date) ==="
```

On your dev machine:
```bash
# Two separate remotes — one for Oxygen (GitHub), one for your server (direct)
git remote add origin https://github.com/youruser/glass-skincare.git   # Hydrogen auto-deploys from here
git remote add api-server user@YOUR_SERVER_IP:C:/repos/glass-skincare-api.git

# Deploy backend only:
git push api-server main

# Deploy frontend (Hydrogen):
git push origin main  # Oxygen auto-picks up the hydrogen/ folder
```

### Step 8: Shopify Webhooks → FastAPI

In Shopify Admin → Settings → Notifications → Webhooks:
```
Webhook 1:
  Event: Products / Product updated
  URL: https://api.glassskincare.co/sync/product-updated
  Format: JSON

Webhook 2:
  Event: Orders / Payment
  URL: https://api.glassskincare.co/sync/order-paid
  Format: JSON
```

Copy the **Webhook signing secret** → add to backend `.env` as `SHOPIFY_WEBHOOK_SECRET`.

---

## CLOUDFLARE SETUP

### DNS Records

For **glassskincare.co** (Shopify Oxygen handles frontend SSL):
```
Type   Name   Value                   Proxy
CNAME  @      shops.myshopify.com     ✗ (grey — Shopify manages SSL)
CNAME  www    shops.myshopify.com     ✗
A      api    YOUR_SERVER_IP          ✓ (orange — Cloudflare proxies FastAPI)
CNAME  assets YOUR_R2_URL             ✗ (grey — R2 handles this)
```

For **glassskincare.in** — same as above.

### Cloudflare Rules (for api.glassskincare.co only)
```
Rule 1: api.glassskincare.co/ai/*
  → Cache Level: Bypass (never cache streaming AI responses)

Rule 2: api.glassskincare.co/admin/*
  → Security Level: High
```

---

## DAILY OPERATIONS

### Check backend status:
```powershell
pm2 status
pm2 logs glass-ai-api
pm2 monit
```

### Check Hydrogen / Oxygen status:
```
Shopify Admin → Hydrogen → Deployments tab
Shows: build status, deploy time, error logs, preview URLs
```

### Restart backend after config change:
```powershell
pm2 restart glass-ai-api
```

### Re-sync product embeddings (after adding products to Shopify):
```bash
cd backend
python scripts/sync_shopify_catalog.py
```

---

## WHEN SOMETHING BREAKS

| Problem | Where to look |
|---|---|
| AI chat not responding | `pm2 logs glass-ai-api` → check Anthropic API key |
| Frontend not loading | Shopify Admin → Hydrogen → Deployments → error logs |
| Oxygen build failed | GitHub Actions tab (Shopify triggers it) |
| Product not appearing on site | Shopify Admin → Products → is it Active and Available on Hydrogen channel? |
| Recommendations wrong | Run `sync_shopify_catalog.py` to regenerate embeddings |
| Admin command bar failing | Check Shopify Admin API token in backend `.env` |
| 502 on api.glassskincare.co | FastAPI crashed → `pm2 restart glass-ai-api` |
