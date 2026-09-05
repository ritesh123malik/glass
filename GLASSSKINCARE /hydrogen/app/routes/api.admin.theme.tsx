/**
 * api.admin.theme.tsx
 * --------------------
 * Admin-only proxy for theme write/reset.
 *   GET  → handled by root loader (no auth, public)
 *   PUT  /api/admin/theme       — replace all tokens
 *   POST /api/admin/theme       (action=reset) — restore defaults
 *
 * Both mutations require a valid admin JWT in the cookie set by
 * `api.admin.login.tsx`. Hydrogen forwards the bearer to FastAPI
 * which verifies it via the same JWKS used at login.
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { getAdminJwtWithSecret } from "~/lib/admin-session.server";
import { FastApiError } from "~/lib/types";

export async function action({ request, context }: ActionFunctionArgs) {
  const fastApiUrl = context.env.FASTAPI_URL;
  const sessionSecret = context.env.SESSION_SECRET ?? "";

  const jwt = await getAdminJwtWithSecret(request, sessionSecret);
  if (!jwt) {
    return jsonError(401, "Admin login required.");
  }

  let payload: { tokens?: Record<string, string>; action?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const isReset = payload.action === "reset";
  const upstreamPath = isReset ? "/admin/theme/reset" : "/admin/theme";
  const upstreamMethod = isReset ? "POST" : "PUT";
  const upstreamBody = isReset ? undefined : JSON.stringify({ tokens: payload.tokens ?? {} });

  try {
    const res = await fetch(`${fastApiUrl}${upstreamPath}`, {
      method: upstreamMethod,
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: upstreamBody,
    });
    if (!res.ok) {
      const detail = await res.text();
      return jsonError(res.status, `Theme ${isReset ? "reset" : "update"} failed: ${detail}`);
    }
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof FastApiError) return jsonError(err.status, err.message);
    return jsonError(502, "Theme service unavailable.");
  }
}

export function loader() {
  return new Response("Method Not Allowed", { status: 405 });
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
