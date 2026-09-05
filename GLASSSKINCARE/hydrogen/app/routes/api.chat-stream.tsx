/**
 * api.chat-stream.tsx
 * --------------------
 * SSE resource route. POST /api/chat-stream
 *
 * Proxies the browser's chat request to FastAPI `/ai/chat`, which
 * streams `data: {json}\n\n` chunks. The browser never talks to FastAPI
 * directly — this keeps the session token cookie scoped to the Oxygen
 * origin and lets Hydrogen headers (request group ID, buyer IP, etc.)
 * flow through naturally.
 *
 * Auth:
 *   - Reads the AI session token from the httpOnly cookie set by
 *     `app/lib/ai-session.ts`. Missing token → 401.
 *   - FastAPI verifies the HMAC + Redis existence of that token.
 *
 * Error mapping:
 *   - Missing cookie         → 401
 *   - FastAPI 4xx/5xx        → mirror status + body to the client
 *   - FastAPI unreachable    → 502
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { FastApiError } from "~/lib/types";
import { getAiToken, getAiTokenWithSecret, setAiTokenWithSecret } from "~/lib/ai-session.server";
import { getSessionToken, postChatStream } from "~/lib/fastapi.server";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatPayload {
  messages: IncomingMessage[];
  shopify_customer_token?: string;
}

export async function action({ request, context }: ActionFunctionArgs) {
  // Only POST is supported on this resource route. Remix auto-routes
  // GET requests elsewhere, but be explicit.
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // ─── 1. Parse + validate request body ───────────────────────────────
  let payload: ChatPayload;
  try {
    payload = (await request.json()) as ChatPayload;
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  if (!Array.isArray(payload?.messages) || payload.messages.length === 0) {
    return jsonError(400, "messages array is required.");
  }

  const sessionSecret = context.env.SESSION_SECRET ?? "";
  const fastApiUrl = context.env.FASTAPI_URL;

  // ─── 2. Resolve session token (cookie or fresh fetch) ──────────────
  let token = sessionSecret
    ? await getAiTokenWithSecret(request, sessionSecret)
    : null;
  let setCookie: string | undefined;
  if (!token) {
    try {
      const freshToken = await getSessionToken(request, fastApiUrl);
      token = freshToken;
      // FastAPI issues tokens with a 15-min TTL; mirror that minus a
      // 60s safety margin so the cookie expires before the upstream.
      setCookie = sessionSecret
        ? await setAiTokenWithSecret(token, 15 * 60 - 60, sessionSecret)
        : undefined;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "session-token failed";
      return jsonError(
        502,
        `Could not obtain AI session token: ${msg}`,
      );
    }
  }

  // ─── 3. Forward to FastAPI; pipe SSE chunks back to the browser ────
  let upstream: ReadableStream<Uint8Array>;
  try {
    upstream = await postChatStream(
      token,
      payload.messages.map((m) => ({ role: m.role, content: m.content })),
      { fastApiUrl, request },
    );
  } catch (err) {
    if (err instanceof FastApiError) {
      // 401 from FastAPI means our cached token has expired/been
      // evicted — tell the browser so it can refresh and retry.
      if (err.status === 401) {
        return jsonError(401, "AI session expired — please refresh.");
      }
      return jsonError(err.status, err.message);
    }
    return jsonError(502, "AI chat service is unavailable.");
  }

  // Build the SSE response with proper headers.
  const responseHeaders = new Headers({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // disable proxy buffering on nginx/etc.
  });

  if (setCookie) responseHeaders.append("Set-Cookie", setCookie);

  return new Response(upstream, {
    status: 200,
    headers: responseHeaders,
  });
}

// GET on a POST-only route → 405 (Remix will route GET to `loader`
// if defined, but we don't want any).
export function loader() {
  return new Response("Method Not Allowed", { status: 405 });
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}