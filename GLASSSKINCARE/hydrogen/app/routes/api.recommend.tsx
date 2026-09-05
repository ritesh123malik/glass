/**
 * api.recommend.tsx
 * -----------------
 * POST /api/recommend — AI product recommendations.
 *
 * Two paths:
 *   1. Authenticated — client sends a Shopify customer access token. We
 *      forward it to FastAPI `/ai/recommend`, which runs pgvector cosine
 *      search over `product_embeddings` filtered by the customer's stored
 *      profile. The response is a list of Shopify handles.
 *   2. Anonymous — no customer token. We fall back to a curated handle
 *      list (operator-tunable) so the recommendations block still renders
 *      something useful before the user signs in.
 *
 * In either case we then hydrate the handles with Storefront product data
 * (image, price, concerns metafield) so the UI gets a single, uniform
 * shape back: `{ products: AIRecommendedProduct[] }`.
 *
 * Errors:
 *   - 405 — non-POST
 *   - 400 — malformed body
 *   - 502 — FastAPI failure (mirrored status)
 *   - 200 + `{ error }` — empty handle list (still success, UI handles)
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { FastApiError, type SkinProfile } from "~/lib/types";
import { postRecommend } from "~/lib/fastapi.server";
import type { ShopifyProductSummary } from "~/lib/shopify";

/** Handles used when the visitor isn't signed in. Operator-tunable. */
const FALLBACK_HANDLES = [
  "bestsellers",
  "hydrating-serum",
  "gentle-cleanser",
  "daily-spf",
];

/**
 * Response shape sent to the browser. We extend the base Shopify summary
 * with AI metadata (match score, concerns, skin types).
 */
export interface AIRecommendedProduct extends ShopifyProductSummary {
  /** Cosine similarity ∈ [0, 1]. Synthesized from rank when anonymous. */
  matchScore: number;
  /** Concerns this product addresses (from the `concerns` metafield). */
  concerns: string[];
  /** Skin types this product suits (from `skin_types` metafield). */
  skinTypes: string[];
}

const STOREFRONT_PRODUCTS_QUERY = `#graphql
  query AIRecommendProducts($query: String!) {
    products(first: 24, query: $query) {
      nodes {
        id
        title
        handle
        description
        featuredImage {
          url
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        metafields(identifiers: [
          { namespace: "skincare", key: "concerns" }
          { namespace: "skincare", key: "skin_types" }
        ]) {
          key
          value
        }
      }
    }
  }
`;

interface StorefrontProductNode {
  id: string;
  title: string;
  handle: string;
  description: string;
  featuredImage: { url: string; altText: string | null } | null;
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
  metafields: ({ key: string; value: string } | null)[];
}

function parseMetafield(
  metafields: ({ key: string; value: string } | null)[],
  key: string,
): string[] {
  const mf = metafields.find((m) => m?.key === key);
  if (!mf?.value) return [];
  try {
    const parsed = JSON.parse(mf.value);
    return Array.isArray(parsed)
      ? parsed.map((x) => String(x))
      : [String(parsed)];
  } catch {
    return [mf.value];
  }
}

/**
 * Synthesize a match score from rank position. Real pgvector cosine
 * similarities cluster around 0.3–0.8 for a relevant profile, so we map
 * rank → score in that band:
 *
 *   rank 1 → 0.94
 *   rank 2 → 0.88
 *   rank 3 → 0.83
 *   rank 4 → 0.78
 *   rank 5 → 0.74
 *
 * Past rank 5 we floor at 0.65 so the pill still feels meaningful.
 */
function scoreFromRank(rank: number): number {
  if (rank <= 1) return 0.94;
  if (rank <= 2) return 0.88;
  if (rank <= 3) return 0.83;
  if (rank <= 4) return 0.78;
  if (rank <= 5) return 0.74;
  return 0.65;
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return jsonError(405, "Method Not Allowed");
  }

  // ─── 1. Parse body ───────────────────────────────────────────────────
  let body: {
    skinProfile?: SkinProfile | null;
    shopifyCustomerToken?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const skinProfile: SkinProfile = body.skinProfile ?? {};
  const customerToken =
    typeof body.shopifyCustomerToken === "string" &&
    body.shopifyCustomerToken.length > 0
      ? body.shopifyCustomerToken
      : null;

  // ─── 2. Resolve recommended handles ─────────────────────────────────
  let handles: string[];
  let source: "fastapi" | "fallback";

  if (customerToken) {
    try {
      const recommended = await postRecommend(customerToken, skinProfile, {
        fastApiUrl: context.env.FASTAPI_URL,
        request,
      });
      handles = recommended;
      source = "fastapi";
    } catch (err) {
      if (err instanceof FastApiError) {
        // 401 from FastAPI means the Shopify customer token is rejected —
        // fall back to curated handles instead of bubbling up so the UI
        // still renders something.
        if (err.status === 401 || err.status === 403) {
          handles = FALLBACK_HANDLES;
          source = "fallback";
        } else {
          return jsonError(err.status, err.message);
        }
      } else {
        return jsonError(502, "Recommendation service is unavailable.");
      }
    }
  } else {
    handles = FALLBACK_HANDLES;
    source = "fallback";
  }

  // ─── 3. Hydrate handles with Storefront product data ─────────────────
  if (handles.length === 0) {
    return new Response(
      JSON.stringify({ products: [], source }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const query = handles.map((h) => `handle:${h}`).join(" OR ");
    const data = await context.storefront.query<{
      products: { nodes: StorefrontProductNode[] };
    }>(STOREFRONT_PRODUCTS_QUERY, { variables: { query } });

    // Preserve the recommended ordering (Storefront may return by
    // relevance, not by handle order).
    const byHandle = new Map<string, StorefrontProductNode>();
    for (const node of data.products.nodes) byHandle.set(node.handle, node);

    const products: AIRecommendedProduct[] = [];
    handles.forEach((handle, idx) => {
      const node = byHandle.get(handle);
      if (!node) return; // handle returned no product (deleted?) — skip
      products.push({
        id: node.id,
        title: node.title,
        handle: node.handle,
        description: node.description,
        featuredImage: node.featuredImage,
        priceRange: node.priceRange,
        matchScore: scoreFromRank(idx + 1),
        concerns: parseMetafield(node.metafields, "concerns"),
        skinTypes: parseMetafield(node.metafields, "skin_types"),
      });
    });

    return new Response(
      JSON.stringify({ products, source }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch {
    return jsonError(502, "Could not load product details.");
  }
}

/** GET on a POST-only resource route → 405. */
export function loader() {
  return new Response("Method Not Allowed", { status: 405 });
}