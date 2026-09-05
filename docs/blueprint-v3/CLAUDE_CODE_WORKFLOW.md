# CLAUDE CODE WORKFLOW
### How to use Claude Code + MiniMax M2.7 effectively every single day

---

## INITIAL SETUP — DO THIS ONCE

### Step 1: Install Claude Code
Claude Code runs in your terminal (or Anti-Gravity IDE terminal panel).
```bash
npm install -g @anthropic/claude-code
claude --version   # verify installation
```

### Step 2: Authenticate
```bash
claude auth login
# Follow the browser prompt, paste your API key
```

### Step 3: Install Required MCP Servers
MCP servers give Claude Code superpowers — file system access, database queries, web search, and more.
Run each of these in your terminal:

```bash
# 1. File system MCP (read/write your project files)
claude mcp add filesystem -- npx -y @modelcontextprotocol/server-filesystem /path/to/glass-skincare

# 2. PostgreSQL MCP (query your database from Claude Code)
claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres postgresql://localhost/glass_skincare

# 3. Git MCP (Claude Code understands your git history)
claude mcp add git -- npx -y @modelcontextprotocol/server-git --repository /path/to/glass-skincare

# 4. Fetch/Web MCP (Claude Code can fetch documentation URLs)
claude mcp add fetch -- npx -y @modelcontextprotocol/server-fetch

# 5. Brave Search MCP (Claude Code can search for solutions)
# Get free API key at: https://brave.com/search/api/
claude mcp add brave-search -- npx -y @modelcontextprotocol/server-brave-search
# Set env: BRAVE_API_KEY=your_key_here

# 6. Memory MCP (Claude Code remembers context between sessions)
claude mcp add memory -- npx -y @modelcontextprotocol/server-memory
```

### Step 4: Verify MCP Servers
```bash
claude mcp list
# Should show: filesystem, postgres, git, fetch, brave-search, memory
```

### Step 5: Create your CLAUDE.md project context file
This file lives at the root of your project. Claude Code reads it automatically every session.
It means Claude Code always knows your project without you re-explaining it.

Create `/glass-skincare/CLAUDE.md`:
```markdown
# Glass Skincare — Claude Code Context

## Project
Skincare e-commerce with AI dermatologist. Two domains: glassskincare.co (primary) and glassskincare.in (India).

## Architecture
- Frontend: Next.js 15, TypeScript, Tailwind, React Three Fiber
- Backend: FastAPI (Python), SQLAlchemy, PostgreSQL + pgvector
- Payments: Stripe
- AI: Claude API (consumer), AI command bar (admin)
- Storage: Cloudflare R2
- Hosting: Windows Server + Nginx

## Key Rules
1. Frontend calls FastAPI only. Never direct DB from frontend.
2. All AI calls go through services/ai_service.py
3. All Stripe calls go through services/stripe_service.py
4. Admin routes require is_admin=True on JWT token
5. Never hardcode secrets — always use config.py which reads .env

## Database
PostgreSQL on localhost:5432, database: glass_skincare
ORM: SQLAlchemy 2.0 with Alembic migrations

## Ports
- Next.js: 3000
- FastAPI: 8000
- PostgreSQL: 5432
- Redis: 6379

## Current Phase
[UPDATE THIS as you move through phases]
Phase 1 — Foundation

## What I'm working on today
[UPDATE THIS each morning]
Setting up database schema and initial FastAPI structure
```

---

## HOW TO WORK WITH CLAUDE CODE EVERY DAY

### Morning Ritual (5 minutes)
1. Open your Anti-Gravity IDE
2. Open the terminal
3. Navigate to your project: `cd /path/to/glass-skincare`
4. Start Claude Code: `claude`
5. Update `CLAUDE.md` → "What I'm working on today" section
6. Open `IMPLEMENTATION_PLAN.md` → find today's tasks

### How to Give Claude Code Instructions

**BAD (vague, leads to wrong code):**
```
Build the products page
```

**GOOD (specific, produces exactly what you want):**
```
Build the FastAPI router for products (backend/app/routers/products.py).
It should have these endpoints:
- GET /products → return all products with pagination (page, limit params)
- GET /products/{slug} → return single product by slug
- POST /products → create product (admin only, check is_admin in JWT)
- PUT /products/{id} → update product (admin only)
- DELETE /products/{id} → soft delete, set is_active=False (admin only)

Use the Product SQLAlchemy model from backend/app/models/product.py
Use the ProductSchema from backend/app/schemas/product.py
Follow the same pattern as backend/app/routers/auth.py
```

### Claude Code Slash Commands
Use these in the Claude Code chat:

```
/help                    → see all available commands
/compact                 → compress context when session gets long
/clear                   → start fresh session
/cost                    → see how many tokens you've used this session
/model                   → check which model is active
```

### When Claude Code Makes a Mistake
Don't start over. Say exactly what's wrong:
```
That's almost right but:
1. The get_products endpoint is missing pagination — add `skip: int = 0, limit: int = 20` params
2. The admin check should use the `get_current_admin` dependency from app/middleware/auth.py
3. Add a search param: `q: Optional[str] = None` that filters by product name
Please fix only these three things, don't rewrite the whole file.
```

### Saving Context Between Sessions
Before you end your session:
```
Summarize what we built today and what state the code is in.
I'll add this to CLAUDE.md for tomorrow.
```
Paste Claude's summary into your `CLAUDE.md` under "What I'm working on today".

---

## MCP SERVER USAGE IN PRACTICE

### Using the PostgreSQL MCP
Instead of opening pgAdmin, ask Claude Code directly:
```
Using the postgres MCP, show me all orders from today with customer names and totals
```
```
Using the postgres MCP, how many customers have placed more than 3 orders?
```
```
Using the postgres MCP, show the top 5 selling products this month
```

### Using the Filesystem MCP
```
Read backend/app/routers/auth.py and then create the same structure for backend/app/routers/products.py
```
```
Look at my existing models in backend/app/models/ and generate the Pydantic schemas in backend/app/schemas/
```

### Using the Git MCP
```
What files did I change yesterday?
```
```
Show me the last 5 commits and what changed in each
```

### Using Fetch MCP
```
Fetch https://docs.anthropic.com/en/api/messages and show me how to use streaming
```
```
Fetch https://stripe.com/docs/api/checkout/sessions/create and help me implement this endpoint
```

---

## MINIMAX M2.7 IN YOUR WORKFLOW

MiniMax M2.7 in your Anti-Gravity IDE handles:
- **Admin workflow commands** — natural language → database operations (built into your admin portal)
- **Code review** — paste a file, ask "is this secure?" or "is this the most efficient query?"
- **Debugging** — paste an error, get a fix
- **Alternative approaches** — "show me 3 different ways to implement this auth flow"

Use Claude Code (Anthropic) for:
- Writing new files and features
- Understanding your codebase
- Refactoring existing code
- Running terminal commands

Use MiniMax M2.7 for:
- Admin AI command bar (built into the product itself)
- Second opinion on architecture decisions
- Generating test data

---

## HOW MANY FILES TO CREATE IN WHICH ORDER

### Week 1 Files (Foundation)
```
backend/app/main.py
backend/app/config.py
backend/app/database.py
backend/app/models/user.py
backend/app/models/product.py
backend/app/models/order.py
backend/app/models/cart.py
backend/app/models/skin_profile.py
backend/app/schemas/user.py
backend/app/schemas/product.py
backend/app/schemas/order.py
backend/app/routers/auth.py
backend/requirements.txt
backend/.env
migrations/ (alembic init)
```

### Week 2 Files (Core API)
```
backend/app/routers/products.py
backend/app/routers/orders.py
backend/app/routers/cart.py
backend/app/routers/customers.py
backend/app/routers/admin.py
backend/app/routers/analytics.py
backend/app/services/stripe_service.py
backend/app/routers/checkout.py
backend/app/routers/webhooks.py
backend/app/middleware/auth.py
backend/app/middleware/rate_limit.py
```

### Week 3 Files (Frontend Foundation)
```
frontend/package.json
frontend/next.config.ts
frontend/tailwind.config.ts
frontend/tsconfig.json
frontend/app/layout.tsx
frontend/app/globals.css
frontend/lib/api.ts
frontend/lib/store.ts
frontend/types/index.ts
frontend/middleware.ts
frontend/components/ui/ (all primitives)
frontend/components/consumer/Navbar.tsx
frontend/components/consumer/Footer.tsx
```

### Week 4 Files (Consumer Pages)
```
frontend/app/(consumer)/page.tsx
frontend/app/(consumer)/products/page.tsx
frontend/app/(consumer)/products/[slug]/page.tsx
frontend/components/consumer/ProductCard.tsx
frontend/components/consumer/CartSidebar.tsx
frontend/app/(consumer)/cart/page.tsx
frontend/app/(consumer)/checkout/page.tsx
```

### Week 5 Files (3D Layer)
```
frontend/components/3d/HeroScene.tsx
frontend/components/3d/ProductViewer.tsx
frontend/components/3d/ParticleField.tsx
frontend/components/3d/FloatingProduct.tsx
public/models/ (your .glb files go here)
```

### Week 6 Files (Admin Portal)
```
frontend/app/(admin)/admin/page.tsx
frontend/app/(admin)/admin/orders/page.tsx
frontend/app/(admin)/admin/customers/page.tsx
frontend/app/(admin)/admin/products/page.tsx
frontend/app/(admin)/admin/analytics/page.tsx
frontend/components/admin/ (all admin components)
```

### Week 7 Files (AI Features)
```
backend/app/services/ai_service.py
backend/app/services/embedding_service.py
backend/app/routers/ai.py
frontend/app/(consumer)/skin-quiz/page.tsx
frontend/components/consumer/DermatologistChat.tsx
frontend/components/consumer/SkinQuiz.tsx
```

### Week 8 Files (Polish + Deploy)
```
scripts/deploy.sh
scripts/backup_db.sh
nginx/glassskincare.co.conf
nginx/glassskincare.in.conf
.gitignore
README.md
```

---

## COMMON CLAUDE CODE PROMPTS FOR THIS PROJECT

Copy and use these exact prompts:

### Generate a FastAPI router
```
Create backend/app/routers/[NAME].py following this pattern:
- Import dependencies from app.database, app.middleware.auth, app.schemas
- Each endpoint uses async def with db: AsyncSession = Depends(get_db)
- Admin endpoints use current_admin = Depends(get_current_admin)
- All responses use the Pydantic schemas from app.schemas.[NAME]
- Include proper HTTP status codes and error handling
- Add these endpoints: [LIST THEM]
```

### Generate a Next.js page
```
Create frontend/app/(consumer)/[ROUTE]/page.tsx
This page should:
- Use 'use client' if it needs state/interactivity
- Fetch data using the api client from lib/api.ts
- Use React Query's useQuery for data fetching with loading/error states
- Style with Tailwind using the design: warm nude palette, Cormorant Garamond headings, minimal
- Be fully responsive (mobile first)
- Feature: [DESCRIBE WHAT IT DOES]
```

### Debug an error
```
I'm getting this error: [PASTE FULL ERROR]
The error is in: [FILE PATH]
Here is the relevant code: [PASTE CODE]
What is causing this and how do I fix it?
```

### Add a database table
```
Add a new SQLAlchemy model to backend/app/models/[NAME].py
Then create the Pydantic schema in backend/app/schemas/[NAME].py
Then generate an Alembic migration
The table needs these columns: [LIST COLUMNS WITH TYPES]
It has these relationships: [LIST RELATIONSHIPS]
```
