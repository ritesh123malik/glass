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
