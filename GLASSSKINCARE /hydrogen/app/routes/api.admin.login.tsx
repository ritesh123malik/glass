/**
 * api.admin.login.tsx
 * --------------------
 * POST /api/admin/login — admin credential exchange.
 *
 * Browser POSTs {email, password} → Hydrogen proxies to FastAPI
 * `/auth/admin-login` → on 200 we set the admin JWT in a signed
 * httpOnly cookie and return `{ ok: true }`. The browser never sees the
 * raw token — it just knows login succeeded.
 *
 * Errors:
 *   - 400 — malformed JSON body
 *   - 401 — FastAPI rejected credentials (bad email/password)
 *   - 403 — user exists but is not flagged as admin
 *   - 502 — FastAPI unreachable
 *   - 500 — SESSION_SECRET missing (cannot sign cookie)
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { FastApiError } from "~/lib/types";
import { setAdminJwt } from "~/lib/admin-session.server";
import { postAdminLogin } from "~/lib/fastapi.server";

interface LoginPayload {
  email?: string;
  password?: string;
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return jsonError(405, "Method Not Allowed");
  }

  // ─── 1. Parse + validate body ─────────────────────────────────────
  let payload: LoginPayload;
  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const email = (payload.email ?? "").trim().toLowerCase();
  const password = payload.password ?? "";

  if (!email || !password) {
    return jsonError(400, "email and password are required.");
  }

  // ─── 2. Verify SESSION_SECRET exists so we can sign the cookie ────
  if (!context.env.SESSION_SECRET) {
    return jsonError(
      500,
      "SESSION_SECRET is not configured — cannot sign admin session.",
    );
  }

  // ─── 3. Forward to FastAPI /auth/admin-login ──────────────────────
  let adminJwt: string;
  try {
    adminJwt = await postAdminLogin(email, password, {
      fastApiUrl: context.env.FASTAPI_URL,
      request,
    });
  } catch (err) {
    if (err instanceof FastApiError) {
      // 401 → bad creds; 403 → non-admin user; otherwise mirror.
      return jsonError(err.status, err.message);
    }
    return jsonError(502, "Admin auth service is unavailable.");
  }

  // ─── 4. Sign + attach the cookie (8h, matches default maxAge) ─────
  try {
    const setCookie = await setAdminJwt(adminJwt, 60 * 60 * 8);
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.append("Set-Cookie", setCookie);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers,
    });
  } catch {
    return jsonError(500, "Could not sign admin session cookie.");
  }
}

/** GET on a POST-only resource route → 405. */
export function loader() {
  return new Response("Method Not Allowed", { status: 405 });
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}