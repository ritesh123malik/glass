# AI INTEGRATION
### Glass Skincare — Claude API Setup, Prompts, Skin Analysis

---

## AI SERVICE (backend/app/services/ai_service.py)

This is the single file that handles ALL Claude API calls. Never call the Anthropic SDK anywhere else.

```python
import anthropic
import json
from typing import AsyncIterator
from app.config import settings

client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

# ─────────────────────────────────────────
# DERMATOLOGIST CHAT (streaming)
# ─────────────────────────────────────────

DERMATOLOGIST_SYSTEM_PROMPT = """
You are Dr. Glow, an expert AI dermatologist for Glass Skincare. You are warm, knowledgeable, and focused on helping customers find the right skincare products for their skin.

YOUR KNOWLEDGE BASE:
{product_catalog}

YOUR RULES:
1. Always ask about skin type if not mentioned (oily/dry/combination/normal/sensitive)
2. Always ask about primary skin concern if not mentioned (acne, pigmentation, aging, dryness, brightening, sensitivity)
3. Recommend ONLY products from the Glass Skincare catalog above
4. Explain WHY a product suits them (ingredients, skin type match)
5. Maximum 3 product recommendations per response — less is more
6. If unsure, ask clarifying questions before recommending
7. Never recommend a product that doesn't match their skin type
8. Keep responses concise — 3-4 sentences max per point
9. End responses with a question to continue the conversation OR a clear call to action ("Add the Vitamin C Serum to your cart — I think you'll love it")
10. Never mention competitors. Never discuss medical conditions requiring a real doctor.
11. Speak in a warm, friendly tone — like a knowledgeable friend, not a textbook.
"""

async def get_dermatologist_response(
    messages: list[dict],
    product_catalog: str,
) -> AsyncIterator[str]:
    """
    Streaming dermatologist response.
    messages format: [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
    """
    system = DERMATOLOGIST_SYSTEM_PROMPT.format(product_catalog=product_catalog)
    
    async with client.messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=500,
        system=system,
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text


# ─────────────────────────────────────────
# SKIN PHOTO ANALYSIS
# ─────────────────────────────────────────

SKIN_ANALYSIS_PROMPT = """
Analyze this selfie for skin concerns. The person wants skincare product recommendations.

Return ONLY valid JSON in this exact format, nothing else:
{
  "skin_type": "oily|dry|combination|normal|sensitive",
  "concerns": ["list", "of", "concerns"],
  "concern_details": {
    "acne": {"present": true/false, "severity": "mild|moderate|severe"},
    "pigmentation": {"present": true/false, "areas": ["forehead", "cheeks", "chin"]},
    "dryness": {"present": true/false, "severity": "mild|moderate|severe"},
    "oiliness": {"present": true/false, "t_zone": true/false},
    "dark_circles": {"present": true/false},
    "large_pores": {"present": true/false},
    "fine_lines": {"present": true/false}
  },
  "overall_skin_health": "poor|fair|good|excellent",
  "recommended_focus": "The single most important thing to address for this person",
  "confidence": 0.85
}

Be honest and accurate. If image quality is poor or face is not clearly visible, set confidence below 0.5.
"""

async def analyze_skin_photo(image_base64: str, image_media_type: str = "image/jpeg") -> dict:
    """
    Analyze a skin photo and return structured JSON.
    image_base64: base64-encoded image string
    """
    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": image_media_type,
                            "data": image_base64,
                        },
                    },
                    {
                        "type": "text",
                        "text": SKIN_ANALYSIS_PROMPT
                    }
                ],
            }
        ],
    )
    
    raw = response.content[0].text.strip()
    # Strip any markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    
    return json.loads(raw.strip())


# ─────────────────────────────────────────
# SKIN QUIZ ROUTINE BUILDER
# ─────────────────────────────────────────

QUIZ_ROUTINE_PROMPT = """
Based on these quiz answers, create a personalized skincare routine using ONLY products from Glass Skincare's catalog.

QUIZ ANSWERS:
{quiz_answers}

AVAILABLE PRODUCTS:
{product_catalog}

Return ONLY valid JSON in this exact format:
{{
  "skin_profile_summary": "2-sentence summary of their skin and what they need",
  "morning_routine": [
    {{
      "step": 1,
      "product_id": "uuid-here",
      "product_name": "Product Name",
      "action": "Cleanse|Treat|Moisturize|Protect",
      "how_to_use": "Apply 2-3 drops to damp face, massage in circular motions",
      "why": "Your oily skin needs this because..."
    }}
  ],
  "evening_routine": [
    {{
      "step": 1,
      "product_id": "uuid-here",
      "product_name": "Product Name",
      "action": "Cleanse|Treat|Moisturize",
      "how_to_use": "...",
      "why": "..."
    }}
  ],
  "key_ingredient_to_look_for": "Niacinamide",
  "ingredient_to_avoid": "Fragrance",
  "routine_goal": "Reduce oil, clear acne, and achieve glass skin in 8 weeks"
}}

Include ONLY products that genuinely suit their skin. Do not force products. 
Morning: 3-4 steps. Evening: 2-3 steps.
"""

async def build_skin_routine(quiz_answers: dict, product_catalog: str) -> dict:
    """
    Build a personalized morning + evening routine from quiz answers.
    """
    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[
            {
                "role": "user",
                "content": QUIZ_ROUTINE_PROMPT.format(
                    quiz_answers=json.dumps(quiz_answers, indent=2),
                    product_catalog=product_catalog
                )
            }
        ],
    )
    
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    
    return json.loads(raw.strip())


# ─────────────────────────────────────────
# ADMIN AI COMMAND PARSER
# ─────────────────────────────────────────

ADMIN_COMMAND_PROMPT = """
You are an AI assistant for the Glass Skincare admin portal. Parse the admin's natural language command and return a structured action.

AVAILABLE ACTIONS:
- filter_orders: filter the orders table (read-only, no confirmation needed)
- update_order_status: change a single order's status
- bulk_refund: refund multiple orders (REQUIRES CONFIRMATION)
- export_data: export data to CSV (no confirmation needed)
- get_analytics: retrieve analytics data (read-only)
- flag_customers: tag/flag customer accounts
- get_low_stock: show low stock products (read-only)
- send_bulk_email: send email to customer segment (REQUIRES CONFIRMATION)

Return ONLY valid JSON:
{{
  "action": "action_name",
  "description": "Plain English: what will happen if confirmed",
  "requires_confirmation": true/false,
  "params": {{
    // action-specific parameters
  }},
  "estimated_impact": "e.g. 3 orders will be refunded totalling ₹5,400"
}}

If you cannot parse the command or it requests something outside these actions, return:
{{
  "action": "unknown",
  "description": "I couldn't understand that command. Try: 'show pending orders', 'refund order #1042', 'export customers to CSV'",
  "requires_confirmation": false,
  "params": {{}}
}}

COMMAND: {command}
"""

async def parse_admin_command(command: str) -> dict:
    """
    Parse a natural language admin command into a structured action.
    """
    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=500,
        messages=[
            {
                "role": "user",
                "content": ADMIN_COMMAND_PROMPT.format(command=command)
            }
        ],
    )
    
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    
    return json.loads(raw.strip())


# ─────────────────────────────────────────
# GENERATE PRODUCT EMBEDDING
# ─────────────────────────────────────────
# Note: This uses OpenAI embeddings since Anthropic doesn't offer them.
# Free alternative: use sentence-transformers locally.
# Install: pip install openai

async def generate_product_embedding(product: dict) -> list[float]:
    """
    Generate a 1536-dim embedding for a product's benefits.
    Used for AI-powered product recommendations.
    
    Call this when:
    - A new product is created
    - A product's description, ingredients, or concerns are updated
    """
    import openai
    text = f"""
    Product: {product['name']}
    Benefits: {product.get('short_description', '')}
    Ingredients: {product.get('ingredients', '')}
    Best for skin types: {', '.join(product.get('skin_types', []))}
    Addresses concerns: {', '.join(product.get('concerns', []))}
    """
    
    client_oai = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client_oai.embeddings.create(
        input=text,
        model="text-embedding-3-small"  # 1536 dimensions, cheap
    )
    return response.data[0].embedding


async def generate_user_skin_embedding(skin_profile: dict) -> list[float]:
    """
    Generate embedding for a user's skin profile.
    Call after quiz completion or photo analysis.
    """
    import openai
    text = f"""
    Skin type: {skin_profile.get('skin_type', '')}
    Concerns: {', '.join(skin_profile.get('concerns', []))}
    Quiz answers: {json.dumps(skin_profile.get('quiz_answers', {}))}
    """
    
    client_oai = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client_oai.embeddings.create(
        input=text,
        model="text-embedding-3-small"
    )
    return response.data[0].embedding
```

---

## AI ROUTER (backend/app/routers/ai.py)

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.middleware.auth import get_current_user, get_current_admin
from app.services import ai_service
from app.schemas.ai import ChatRequest, SkinAnalysisRequest, QuizRequest, AdminCommandRequest
from app.models.product import Product
from sqlalchemy import select
import json

router = APIRouter(prefix="/ai", tags=["ai"])


def build_product_catalog(products: list) -> str:
    """Format products as a string for injection into AI prompts"""
    catalog = []
    for p in products:
        catalog.append(
            f"- {p.name} (ID: {p.id})\n"
            f"  Price: ₹{p.price}\n"
            f"  For: {', '.join(p.skin_types or [])}\n"
            f"  Addresses: {', '.join(p.concerns or [])}\n"
            f"  Description: {p.short_description or ''}"
        )
    return "\n\n".join(catalog)


@router.post("/chat")
async def chat_with_dermatologist(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """Streaming AI dermatologist chat"""
    # Fetch active products for context
    result = await db.execute(select(Product).where(Product.is_active == True))
    products = result.scalars().all()
    catalog = build_product_catalog(products)
    
    async def generate():
        async for chunk in ai_service.get_dermatologist_response(
            messages=request.messages,
            product_catalog=catalog
        ):
            yield f"data: {json.dumps({'text': chunk})}\n\n"
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/analyze-skin")
async def analyze_skin_photo(
    request: SkinAnalysisRequest,
    db: AsyncSession = Depends(get_db)
):
    """Analyze skin photo and return structured JSON with recommendations"""
    try:
        analysis = await ai_service.analyze_skin_photo(
            image_base64=request.image_base64,
            image_media_type=request.media_type
        )
        
        # Find matching products
        result = await db.execute(
            select(Product).where(
                Product.is_active == True,
                Product.skin_types.contains([analysis.get('skin_type', '')])
            ).limit(3)
        )
        recommended = result.scalars().all()
        
        return {
            "analysis": analysis,
            "recommended_products": [
                {"id": str(p.id), "name": p.name, "price": float(p.price)}
                for p in recommended
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image analysis failed: {str(e)}")


@router.post("/skin-quiz")
async def process_skin_quiz(
    request: QuizRequest,
    db: AsyncSession = Depends(get_db)
):
    """Process quiz answers, return personalized routine"""
    result = await db.execute(select(Product).where(Product.is_active == True))
    products = result.scalars().all()
    catalog = build_product_catalog(products)
    
    routine = await ai_service.build_skin_routine(
        quiz_answers=request.answers,
        product_catalog=catalog
    )
    return routine


@router.post("/admin/command")
async def process_admin_command(
    request: AdminCommandRequest,
    current_admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Parse and prepare an admin natural language command"""
    result = await ai_service.parse_admin_command(request.command)
    return result
```

---

## FRONTEND: DERMATOLOGIST CHAT WIDGET

The chat widget is a floating button (bottom-right corner) that expands into a chat panel.

### Key implementation details (DermatologistChat.tsx):
```
State:
- isOpen: boolean (widget open/closed)
- messages: {role, content}[] (conversation history)
- isLoading: boolean
- imageFile: File | null (for photo analysis)

On send message:
1. Add user message to messages array
2. POST to /api/ai/chat with full messages array
3. ReadableStream the response (SSE)
4. Append chunks to the last assistant message in real-time
5. When [DONE] received, mark loading=false

On photo upload:
1. Convert to base64
2. POST to /api/ai/analyze-skin
3. Show analysis results
4. Show recommended product cards with "Add to cart" buttons

Floating widget position:
- Fixed bottom-right: bottom-6 right-6
- Collapsed: circular button with sparkle icon
- Expanded: 380px wide, 520px tall chat panel
- On mobile: full screen when open
```

---

## SKIN QUIZ QUESTIONS (5 steps)

```javascript
const QUIZ_STEPS = [
  {
    id: 'skin_type',
    question: 'How would you describe your skin?',
    options: ['Oily (shiny by midday)', 'Dry (tight, flaky)', 'Combination (oily T-zone)', 'Normal (balanced)', 'Sensitive (reacts easily)']
  },
  {
    id: 'primary_concern',
    question: 'What is your biggest skin concern right now?',
    options: ['Acne & breakouts', 'Dark spots & pigmentation', 'Dullness & uneven tone', 'Dryness & dehydration', 'Fine lines & aging', 'Large pores']
  },
  {
    id: 'current_routine',
    question: 'What does your current routine look like?',
    options: ['I barely do anything', 'Just a basic cleanser + moisturiser', 'Full routine with serums', 'I have an existing brand I love']
  },
  {
    id: 'lifestyle',
    question: 'Tell us about your lifestyle',
    options: ['Mostly indoors, low pollution', 'Outdoors daily, high sun exposure', 'High stress, little sleep', 'Balanced lifestyle']
  },
  {
    id: 'budget',
    question: 'What is your skincare budget per month?',
    options: ['Under ₹500', '₹500 – ₹1,500', '₹1,500 – ₹3,000', 'No budget limit, best quality only']
  }
]
```

---

## ADDING EMBEDDINGS TO EXISTING PRODUCTS

Run this script once to generate embeddings for all your products.
```python
# scripts/generate_embeddings.py
import asyncio
from app.database import AsyncSessionLocal
from app.models.product import Product
from app.services.ai_service import generate_product_embedding
from sqlalchemy import select

async def embed_all_products():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Product).where(
                Product.is_active == True,
                Product.benefit_embedding.is_(None)
            )
        )
        products = result.scalars().all()
        
        for product in products:
            print(f"Embedding: {product.name}")
            embedding = await generate_product_embedding({
                "name": product.name,
                "short_description": product.short_description,
                "ingredients": product.ingredients,
                "skin_types": product.skin_types,
                "concerns": product.concerns,
            })
            product.benefit_embedding = embedding
            await db.commit()
            print(f"✓ Done: {product.name}")

asyncio.run(embed_all_products())
```
