"""AI Service — single file for all Claude API calls."""
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

async def get_dermatologist_response_stream(
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
