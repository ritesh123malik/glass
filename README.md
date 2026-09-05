# Glass Skincare

AI-powered skincare e-commerce: Shopify Hydrogen storefront + FastAPI AI engine + Anthropic Claude.

## Layout

```
GLASSSKINCARE /
  backend/     FastAPI AI engine (auth, admin, sync, embeddings)
  hydrogen/    Shopify Hydrogen storefront (cart, checkout, AI chat, admin)
  README.md    Project quick-start + service table
docs/          Blueprint v3 architecture docs
```

## Quick Start

```bash
cd "GLASSSKINCARE /hydrogen"
npm install
cp .env.example .env   # fill in Shopify storefront tokens
npm run dev            # storefront on http://localhost:3000

# backend (separate terminal)
cd "GLASSSKINCARE /backend"
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

See `GLASSSKINCARE /README.md` for the full quick-start, service table, and deployment notes.
