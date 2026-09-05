# DATABASE SCHEMA
### Glass Skincare — PostgreSQL + pgvector (AI & Skin Data Only)
### v2.0: Commerce data (orders, cart, products) now lives in Shopify. This DB stores AI intelligence only.

---

## WHAT'S IN THIS DATABASE vs. SHOPIFY

```
YOUR POSTGRESQL DATABASE:          SHOPIFY (managed for you):
─────────────────────────          ─────────────────────────
users (AI profile mapping)         Products & Variants
skin_profiles                      Inventory
ai_conversations                   Carts
product_embeddings                 Checkout Sessions
admin_actions (audit log)          Orders & Order Items
                                   Customers (primary record)
                                   Payments & Refunds
```

Your database is the AI intelligence layer. Shopify is the commerce layer.
They are linked by `shopify_customer_id` (on your users table) and `shopify_product_id` (on your embeddings table).

---

## SETUP: ENABLE EXTENSIONS

Run these once in pgAdmin or psql before creating tables:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

---

## TABLES

### users
Maps your AI profiles to Shopify customer accounts.
```sql
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shopify_customer_id VARCHAR(255) UNIQUE,   -- Shopify customer GID (gid://shopify/Customer/123)
    email               VARCHAR(255) UNIQUE NOT NULL,
    is_admin            BOOLEAN DEFAULT FALSE NOT NULL,  -- for AI command bar access only
    skin_embedding      vector(1536),           -- pgvector: AI skin profile
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_shopify_id ON users(shopify_customer_id);
CREATE INDEX idx_skin_embedding ON users USING hnsw (skin_embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
```

> **No password_hash**: Authentication is handled by Shopify Customer Accounts.
> Your FastAPI verifies the Shopify customer session token, not a local password.

### skin_profiles
```sql
CREATE TABLE skin_profiles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skin_type       VARCHAR(50),            -- oily, dry, combination, normal, sensitive
    concerns        TEXT[],                 -- ['acne', 'pigmentation', 'aging', 'dryness']
    quiz_answers    JSONB,                  -- raw quiz answers from skin quiz
    photo_analysis  JSONB,                  -- AI vision analysis result
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_skin_profiles_user ON skin_profiles(user_id);
```

### product_embeddings
Maps Shopify product IDs to pgvector embeddings for AI recommendations.
```sql
CREATE TABLE product_embeddings (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shopify_product_id  VARCHAR(255) UNIQUE NOT NULL,  -- gid://shopify/Product/8845123456
    shopify_handle      VARCHAR(255) NOT NULL,          -- slug used in Storefront API queries
    product_name        VARCHAR(255) NOT NULL,          -- snapshot for AI context
    skin_types          TEXT[],                         -- ['oily', 'combination']
    concerns            TEXT[],                         -- ['acne', 'brightening']
    ingredients_summary TEXT,                           -- short text for embedding generation
    benefit_embedding   vector(1536),                   -- pgvector: for AI recommendations
    last_synced_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_product_embeddings_shopify_id ON product_embeddings(shopify_product_id);
CREATE INDEX idx_product_embeddings_handle ON product_embeddings(shopify_handle);
CREATE INDEX idx_benefit_embedding ON product_embeddings
    USING hnsw (benefit_embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
```

### ai_conversations
```sql
CREATE TABLE ai_conversations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
    session_id      VARCHAR(255),                   -- for anonymous users
    messages        JSONB NOT NULL DEFAULT '[]',    -- [{role, content}]
    skin_analysis   JSONB,                          -- photo analysis result
    recommendations JSONB,                          -- Shopify product handles recommended
    converted       BOOLEAN DEFAULT FALSE,          -- did they add to Shopify cart?
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_conv_user ON ai_conversations(user_id);
CREATE INDEX idx_ai_conv_session ON ai_conversations(session_id);
```

### admin_actions
Audit log for every AI command bar action.
```sql
CREATE TABLE admin_actions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id    UUID NOT NULL REFERENCES users(id),
    action      VARCHAR(255) NOT NULL,      -- "order.refund", "order.status_update"
    target_type VARCHAR(100),               -- "shopify_order", "shopify_customer"
    target_id   VARCHAR(255),               -- Shopify GID of the target record
    command     TEXT,                       -- original AI command text
    details     JSONB,                      -- what changed
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_actions_admin ON admin_actions(admin_id);
CREATE INDEX idx_admin_actions_created ON admin_actions(created_at DESC);
```

---

## SQLALCHEMY MODELS

### Base Model (backend/app/database.py)
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

### User Model (backend/app/models/user.py)
```python
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from datetime import datetime
import uuid
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shopify_customer_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    skin_embedding: Mapped[list | None] = mapped_column(Vector(1536))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    skin_profile: Mapped["SkinProfile | None"] = relationship(back_populates="user", uselist=False)
    ai_conversations: Mapped[list["AIConversation"]] = relationship(back_populates="user")
```

### ProductEmbedding Model (backend/app/models/product_embedding.py)
```python
from sqlalchemy import String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from pgvector.sqlalchemy import Vector
from datetime import datetime
import uuid
from app.database import Base

class ProductEmbedding(Base):
    __tablename__ = "product_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shopify_product_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    shopify_handle: Mapped[str] = mapped_column(String(255), nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    skin_types: Mapped[list | None] = mapped_column(ARRAY(String))
    concerns: Mapped[list | None] = mapped_column(ARRAY(String))
    ingredients_summary: Mapped[str | None] = mapped_column(Text)
    benefit_embedding: Mapped[list | None] = mapped_column(Vector(1536))
    last_synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
```

---

## AI RECOMMENDATION QUERY

```python
# Find Shopify product handles most similar to a user's skin profile.
# Hydrogen uses these handles to fetch live price + stock from Shopify Storefront API.

from pgvector.sqlalchemy import Vector
from sqlalchemy import select
from app.models.user import User
from app.models.product_embedding import ProductEmbedding

async def get_recommended_shopify_handles(user_id: uuid.UUID, db: AsyncSession, limit: int = 5) -> list[str]:
    """Returns Shopify product handles sorted by AI similarity to the user's skin profile."""
    user = await db.get(User, user_id)

    if not user or user.skin_embedding is None:
        # No profile yet — return handles for products tagged as 'featured' in your embeddings table
        result = await db.execute(
            select(ProductEmbedding.shopify_handle).limit(limit)
        )
        return result.scalars().all()

    # Vector similarity search — returns handles ordered by cosine distance
    result = await db.execute(
        select(ProductEmbedding.shopify_handle)
        .where(ProductEmbedding.benefit_embedding.isnot(None))
        .order_by(ProductEmbedding.benefit_embedding.cosine_distance(user.skin_embedding))
        .limit(limit)
    )
    return result.scalars().all()
```

The Hydrogen route then fetches live Shopify data for those handles:
```typescript
// hydrogen/app/routes/api.ai-recommend.ts
export async function loader({ context }: LoaderFunctionArgs) {
  const handles = await fetch(`${context.env.FASTAPI_URL}/ai/recommend`, ...);

  // Fetch live product data for each handle from Shopify Storefront API
  const products = await Promise.all(
    handles.map(handle => context.storefront.query(PRODUCT_QUERY, { variables: { handle } }))
  );
  return json({ products });
}
```

---

## SHOPIFY CATALOG SYNC SCRIPT

Run this script whenever you add or update products in Shopify.
It pulls all products from Shopify Admin API and generates embeddings for AI recommendations.

```python
# scripts/sync_shopify_catalog.py

import asyncio
import httpx
from anthropic import AsyncAnthropic

SHOPIFY_ADMIN_URL = "https://glassskincare.myshopify.com/admin/api/2024-01/graphql.json"
SHOPIFY_ADMIN_TOKEN = "shpat_..."  # from .env

PRODUCTS_QUERY = """
query {
  products(first: 250) {
    edges {
      node {
        id
        handle
        title
        description
        tags        # use tags like skin:oily, concern:acne for AI matching
        metafields(identifiers: [
          { namespace: "skincare", key: "skin_types" },
          { namespace: "skincare", key: "concerns" },
          { namespace: "skincare", key: "ingredients" }
        ]) {
          key
          value
        }
      }
    }
  }
}
"""

async def sync():
    async with httpx.AsyncClient() as client:
        r = await client.post(
            SHOPIFY_ADMIN_URL,
            json={"query": PRODUCTS_QUERY},
            headers={"X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN}
        )
        products = r.json()["data"]["products"]["edges"]

    # For each product, generate embedding and upsert to product_embeddings table
    # See embedding_service.py for generate_embedding() implementation
    for edge in products:
        p = edge["node"]
        # ... generate embedding, upsert to DB
        print(f"Synced: {p['handle']}")

asyncio.run(sync())
```

---

## DAILY BACKUP SCRIPT (scripts/backup_db.sh)

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="glass_ai_backup_$DATE.sql"

pg_dump -U postgres glass_skincare > /tmp/$BACKUP_FILE
gzip /tmp/$BACKUP_FILE

aws s3 cp /tmp/$BACKUP_FILE.gz s3://glass-skincare-backups/$BACKUP_FILE.gz \
    --endpoint-url https://[your-account-id].r2.cloudflarestorage.com

rm /tmp/$BACKUP_FILE.gz
echo "Backup complete: $BACKUP_FILE.gz"
```
