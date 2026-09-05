/**
 * Server-side FastAPI client. Used by Hydrogen loaders/actions to call
 * AI endpoints (chat, quiz, photo analysis, recommendations, admin).
 *
 * Hydrogen NEVER calls Anthropic directly — all LLM traffic flows through
 * FastAPI. This module is the only place that knows the FastAPI URL.
 *
 * Conventions:
 * - All non-2xx responses throw FastApiError with the parsed body so
 *   callers can branch on status.
 * - The session token is required for anonymous endpoints (chat, quiz,
 *   analyze-skin); pass it via the second arg of each helper.
 * - The session token is cached in-memory for 14 minutes (slightly under
 *   the 15-min FastAPI TTL) to avoid hammering `/session-token` on every
 *   request.
 * - Admin endpoints require an admin JWT passed via `Authorization: Bearer`.
 */
import {
  FastApiError,
  type AnalyzeSkinResult,
  type ChatMessage,
  type Product,
  type QuizAnswers,
  type RoutineResult,
  type SkinProfile,
} from "./types";

/** Reads the FastAPI URL from loader context.env (preferred) or process.env fallback. */
export function getFastApiUrl(env?: { FASTAPI_URL?: string }): string {
  const url = env?.FASTAPI_URL ?? process.env.FASTAPI_URL ?? "http://localhost:8000";
  return url.replace(/\/+$/, "");
}

// ─── Session token cache ─────────────────────────────────────────────────

interface CachedToken {
  token: string;
  /** Epoch ms when this cache entry expires. */
  expiresAt: number;
}

const TOKEN_CACHE = new Map<string, CachedToken>();
const TOKEN_TTL_MS = 14 * 60 * 1000; // 14 min — under FastAPI's 15 min ceiling

/**
 * Returns a valid AI session token for the given FastAPI base URL.
 *
 * Caches for 14 minutes keyed by base URL so concurrent requests share
 * one upstream call. Refreshes the cache on any non-2xx so a stale/expired
 * HMAC signature never reaches `/ai/chat`.
 *
 * Pass the incoming Request so its `signal` aborts the upstream fetch
 * when the consumer disconnects.
 */
export async function getSessionToken(
  request: Request,
  fastApiUrl?: string,
): Promise<string> {
  const base = getFastApiUrl(
    fastApiUrl ? { FASTAPI_URL: fastApiUrl } : undefined,
  );
  const now = Date.now();
  const cached = TOKEN_CACHE.get(base);
  if (cached && cached.expiresAt > now) {
    return cached.token;
  }

  const res = await fetch(`${base}/ai/session-token`, {
    method: "GET",
    signal: request.signal,
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await safeJson(res);
    throw new FastApiError(
      "/ai/session-token",
      res.status,
      body,
      `Failed to obtain AI session token (${res.status})`,
    );
  }

  const data = (await res.json()) as { token: string; expires_in?: number };
  if (!data?.token) {
    throw new FastApiError(
      "/ai/session-token",
      502,
      data,
      "FastAPI returned an empty session token",
    );
  }

  // Prefer server-supplied TTL; fall back to local ceiling.
  const ttlMs = data.expires_in
    ? Math.max(60_000, (data.expires_in - 60) * 1000) // 1 min safety margin
    : TOKEN_TTL_MS;

  TOKEN_CACHE.set(base, { token: data.token, expiresAt: now + ttlMs });
  return data.token;
}

/** Test/utility: clear the in-memory token cache (e.g. on logout). */
export function clearSessionTokenCache(fastApiUrl?: string): void {
  if (fastApiUrl) {
    TOKEN_CACHE.delete(getFastApiUrl({ FASTAPI_URL: fastApiUrl }));
  } else {
    TOKEN_CACHE.clear();
  }
}

// ─── Internal request helper ─────────────────────────────────────────────

async function postJson<TResp>(
  endpoint: string,
  body: unknown,
  init: {
    token?: string;
    fastApiUrl?: string;
    request?: Request;
  } = {},
): Promise<TResp> {
  const base = getFastApiUrl(
    init.fastApiUrl ? { FASTAPI_URL: init.fastApiUrl } : undefined,
  );
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (init.token) headers["X-AI-Session-Token"] = init.token;

  const res = await fetch(`${base}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: init.request?.signal,
  });

  if (!res.ok) {
    const errBody = await safeJson(res);
    throw new FastApiError(endpoint, res.status, errBody);
  }

  return (await res.json()) as TResp;
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    try {
      return await res.text();
    } catch {
      return null;
    }
  }
}

// ─── Chat (streaming SSE) ────────────────────────────────────────────────

/**
 * POST `/ai/chat` and return the raw `ReadableStream<Uint8Array>` so the
 * caller can pipe SSE chunks directly to the browser (server-to-client
 * fetch response, no Anthropic round-trip from the client).
 *
 * Throws FastApiError on any non-2xx before the stream begins.
 */
export async function postChatStream(
  token: string,
  messages: ChatMessage[],
  init: { fastApiUrl?: string; request?: Request; signal?: AbortSignal } = {},
): Promise<ReadableStream<Uint8Array>> {
  const base = getFastApiUrl(
    init.fastApiUrl ? { FASTAPI_URL: init.fastApiUrl } : undefined,
  );
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (token) headers["X-AI-Session-Token"] = token;

  const res = await fetch(`${base}/ai/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ messages }),
    signal: init.request?.signal ?? init.signal,
  });

  if (!res.ok || !res.body) {
    const errBody = await safeJson(res);
    throw new FastApiError("/ai/chat", res.status, errBody);
  }
  return res.body;
}

// ─── Skin quiz ───────────────────────────────────────────────────────────

export async function postSkinQuiz(
  token: string,
  answers: QuizAnswers,
  init: { fastApiUrl?: string; request?: Request } = {},
): Promise<RoutineResult> {
  return postJson<RoutineResult>(
    "/ai/skin-quiz",
    { answers },
    { token, fastApiUrl: init.fastApiUrl, request: init.request },
  );
}

// ─── Photo analysis ──────────────────────────────────────────────────────

export async function postAnalyzeSkin(
  token: string,
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" = "image/jpeg",
  init: { fastApiUrl?: string; request?: Request } = {},
): Promise<AnalyzeSkinResult> {
  return postJson<AnalyzeSkinResult>(
    "/ai/analyze-skin",
    { image_base64: imageBase64, media_type: mediaType },
    { token, fastApiUrl: init.fastApiUrl, request: init.request },
  );
}

// ─── Recommend (pgvector cosine search) ─────────────────────────────────

/**
 * Backend resolves a skin profile from the Shopify customer token, runs
 * pgvector cosine search over product_embeddings, and returns the top-5
 * Shopify handles. The `profile` arg is reserved for future client-side
 * overrides; the canonical source is the customer's stored embedding.
 */
export async function postRecommend(
  shopifyCustomerToken: string,
  profile: SkinProfile | null,
  init: { fastApiUrl?: string; request?: Request } = {},
): Promise<string[]> {
  type Resp = { recommended_handles: string[] };
  const resp = await postJson<Resp>(
    "/ai/recommend",
    { shopify_customer_token: shopifyCustomerToken, profile: profile ?? undefined },
    { fastApiUrl: init.fastApiUrl, request: init.request },
  );
  return resp.recommended_handles ?? [];
}

// ─── Re-export shared product type so callers don't reach into types.ts ─

export type { Product };

// ─── Admin auth + command bar ────────────────────────────────────────────

/**
 * POST `/auth/admin-login` and return the JWT issued by FastAPI.
 *
 * Mirrors `getSessionToken` but for the admin portal. NOT cached — each
 * login attempt must hit the upstream so a fresh credential check runs.
 */
export async function postAdminLogin(
  email: string,
  password: string,
  init: { fastApiUrl?: string; request?: Request } = {},
): Promise<string> {
  const base = getFastApiUrl(
    init.fastApiUrl ? { FASTAPI_URL: init.fastApiUrl } : undefined,
  );
  const res = await fetch(`${base}/auth/admin-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ email, password }),
    signal: init.request?.signal,
  });

  if (!res.ok) {
    const errBody = await safeJson(res);
    throw new FastApiError(
      "/auth/admin-login",
      res.status,
      errBody,
      `Admin login failed (${res.status})`,
    );
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data?.access_token) {
    throw new FastApiError(
      "/auth/admin-login",
      502,
      data,
      "FastAPI returned an empty admin JWT",
    );
  }
  return data.access_token;
}

/**
 * POST `/admin/parse-command` with an admin JWT.
 * Returns the parsed action JSON (action, description, requires_confirmation, params, estimated_impact).
 */
export async function postParseCommand(
  adminJwt: string,
  command: string,
  init: { fastApiUrl?: string; request?: Request } = {},
): Promise<{
  action: string;
  description: string;
  requires_confirmation: boolean;
  params: Record<string, unknown>;
  estimated_impact?: string | null;
  validated?: boolean;
  reason?: string | null;
  clamped_params?: Record<string, unknown> | null;
}> {
  return postJsonAuth<{
    action: string;
    description: string;
    requires_confirmation: boolean;
    params: Record<string, unknown>;
    estimated_impact?: string | null;
    validated?: boolean;
    reason?: string | null;
    clamped_params?: Record<string, unknown> | null;
  }>(
    "/admin/parse-command",
    { command },
    { token: adminJwt, fastApiUrl: init.fastApiUrl, request: init.request },
  );
}

/**
 * POST `/admin/ai-command/execute` with an admin JWT.
 * Re-runs the whitelist server-side; the UI must send `confirmed: true`
 * for mutating actions (refund, cancel, status change, etc.).
 *
 * Returns:
 *   - status: "executed"        → action ran (or queued, depending on action)
 *   - status: "requires_confirm" → server says `confirmed: true` is needed
 *   - status: "rejected"        → blocked or param-clamp failure; check `reason`
 */
export async function postExecuteCommand(
  adminJwt: string,
  payload: {
    action: string;
    params: Record<string, unknown>;
    confirmed: boolean;
  },
  init: { fastApiUrl?: string; request?: Request } = {},
): Promise<{
  status: "executed" | "requires_confirm" | "rejected";
  action: string;
  result?: Record<string, unknown> | null;
  reason?: string | null;
  requires_confirm?: boolean;
}> {
  return postJsonAuth<{
    status: "executed" | "requires_confirm" | "rejected";
    action: string;
    result?: Record<string, unknown> | null;
    reason?: string | null;
    requires_confirm?: boolean;
  }>(
    "/admin/ai-command/execute",
    payload,
    { token: adminJwt, fastApiUrl: init.fastApiUrl, request: init.request },
  );
}

/**
 * GET `/admin/dashboard` with an admin JWT.
 */
export async function getAdminDashboard(
  adminJwt: string,
  init: { fastApiUrl?: string; request?: Request } = {},
): Promise<{
  total_users: number;
  conversations_last_7d: number;
  low_stock_products: Array<Record<string, unknown>>;
}> {
  return getJsonAuth<{
    total_users: number;
    conversations_last_7d: number;
    low_stock_products: Array<Record<string, unknown>>;
  }>("/admin/dashboard", { token: adminJwt, fastApiUrl: init.fastApiUrl, request: init.request });
}

/**
 * GET `/admin/orders` with an admin JWT.
 */
export async function getAdminOrders(
  adminJwt: string,
  init: { fastApiUrl?: string; request?: Request } = {},
): Promise<{
  orders: Array<{
    id: string;
    name: string;
    created_at: string;
    financial_status: string;
    fulfillment_status: string | null;
    total_price: string;
    line_items: Array<{
      id: string;
      title: string;
      quantity: number;
      price: string;
    }>;
  }>;
}> {
  return getJsonAuth<{
    orders: Array<{
      id: string;
      name: string;
      created_at: string;
      financial_status: string;
      fulfillment_status: string | null;
      total_price: string;
      line_items: Array<{
        id: string;
        title: string;
        quantity: number;
        price: string;
      }>;
    }>;
  }>("/admin/orders", { token: adminJwt, fastApiUrl: init.fastApiUrl, request: init.request });
}

// Internal: POST + Bearer token
async function postJsonAuth<TResp>(
  endpoint: string,
  body: unknown,
  init: {
    token: string;
    fastApiUrl?: string;
    request?: Request;
  },
): Promise<TResp> {
  const base = getFastApiUrl(
    init.fastApiUrl ? { FASTAPI_URL: init.fastApiUrl } : undefined,
  );
  const res = await fetch(`${base}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${init.token}`,
    },
    body: JSON.stringify(body),
    signal: init.request?.signal,
  });
  if (!res.ok) {
    const errBody = await safeJson(res);
    throw new FastApiError(endpoint, res.status, errBody);
  }
  return (await res.json()) as TResp;
}

// Internal: GET + Bearer token
async function getJsonAuth<TResp>(
  endpoint: string,
  init: {
    token: string;
    fastApiUrl?: string;
    request?: Request;
  },
): Promise<TResp> {
  const base = getFastApiUrl(
    init.fastApiUrl ? { FASTAPI_URL: init.fastApiUrl } : undefined,
  );
  const res = await fetch(`${base}${endpoint}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${init.token}`,
    },
    signal: init.request?.signal,
  });
  if (!res.ok) {
    const errBody = await safeJson(res);
    throw new FastApiError(endpoint, res.status, errBody);
  }
  return (await res.json()) as TResp;
}
