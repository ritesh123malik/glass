/**
 * api.ai-session.tsx
 * -------------------
 * GET /api/ai-session — mints an AI session token and stores it in the
 * signed httpOnly cookie so subsequent /api/chat-stream calls don't
 * have to re-fetch from FastAPI.
 *
 * Returns `{ token, expires_in }` to the browser so the widget can
 * surface a "session ready" state in the UI if needed. The token in
 * the cookie is what actually authenticates — the body is informational.
 *
 * Why a separate route?
 *   - Lets the widget "warm" a session before the first user message
 *     (so the SSE response doesn't have a TTFB hit for token minting).
 *   - Keeps the cookie-writing contract in one place.
 */
import type { LoaderFunctionArgs } from "@remix-run/node";
import { FastApiError } from "~/lib/types";
import { getAiToken, getAiTokenWithSecret, setAiToken, setAiTokenWithSecret } from "~/lib/ai-session.server";
import { getSessionToken } from "~/lib/fastapi.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const sessionSecret =
    context.env.SESSION_SECRET ?? process.env.SESSION_SECRET ?? "";

  try {
    const token = await getSessionToken(
      request,
      context.env.FASTAPI_URL,
    );
    const expiresIn = 15 * 60 - 60;
    let setCookie: string | null = null;
    if (sessionSecret) {
      const existing = await getAiTokenWithSecret(request, sessionSecret);
      if (existing) {
        return jsonWithSessionCookie(
          { token: existing, expires_in: 15 * 60, fresh: false },
          null,
        );
      }
      setCookie = await setAiTokenWithSecret(token, expiresIn, sessionSecret);
    }
    return jsonWithSessionCookie(
      { token, expires_in: expiresIn, fresh: true },
      setCookie,
    );
  } catch (err) {
    if (err instanceof FastApiError) {
      return new Response(
        JSON.stringify({
          error: err.message,
          status: err.status,
        }),
        {
          status: err.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    return new Response(
      JSON.stringify({
        error:
          err instanceof Error
            ? err.message
            : "Could not obtain AI session token.",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

function jsonWithSessionCookie(
  body: Record<string, unknown>,
  setCookie: string | null,
) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return new Response(JSON.stringify(body), { status: 200, headers });
}