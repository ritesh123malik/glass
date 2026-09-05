/**
 * api.admin.parse-command.tsx
 * ----------------------------
 * POST /api/admin/parse-command — natural-language admin action parser.
 *
 * Browser POSTs {command} → Hydrogen requires admin JWT cookie → proxies
 * to FastAPI `/admin/parse-command` → returns parsed action JSON:
 *   { action, description, requires_confirmation, params, estimated_impact }
 *
 * Auth:
 *   - Reads the admin JWT from the signed httpOnly cookie set by
 *     `api.admin.login.tsx`. Missing cookie → 401.
 *
 * Errors:
 *   - 405 — non-POST
 *   - 400 — malformed JSON / missing `command`
 *   - 401 — no admin cookie (or cookie invalid)
 *   - 502 — FastAPI unreachable
 *   - 200 + body — FastAPI's parsed-action JSON (or 4xx/5xx mirrored)
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { FastApiError } from "~/lib/types";
import { getAdminJwt } from "~/lib/admin-session.server";
import { postParseCommand } from "~/lib/fastapi.server";

interface ParseCommandPayload {
  command?: string;
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return jsonError(405, "Method Not Allowed");
  }

  // ─── 1. Parse + validate body ─────────────────────────────────────
  let payload: ParseCommandPayload;
  try {
    payload = (await request.json()) as ParseCommandPayload;
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const command = (payload.command ?? "").trim();
  if (!command) {
    return jsonError(400, "command is required.");
  }

  // ─── 2. Verify admin JWT cookie ───────────────────────────────────
  const adminJwt = await getAdminJwt(request);
  if (!adminJwt) {
    return jsonError(401, "Admin login required.");
  }

  // ─── 3. Forward to FastAPI /admin/parse-command ───────────────────
  try {
    const result = await postParseCommand(adminJwt, command, {
      fastApiUrl: context.env.FASTAPI_URL,
      request,
    });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof FastApiError) {
      // 401 from FastAPI → our cached JWT is stale/expired.
      if (err.status === 401 || err.status === 403) {
        return jsonError(401, "Admin session expired — please log in again.");
      }
      return jsonError(err.status, err.message);
    }
    return jsonError(502, "Admin command service is unavailable.");
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