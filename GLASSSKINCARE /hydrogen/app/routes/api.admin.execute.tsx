/**
 * api.admin.execute.tsx
 * ---------------------
 * POST /api/admin/execute — confirms + executes a parsed admin action.
 *
 * Browser POSTs {action, params, confirmed} → Hydrogen requires admin JWT
 * cookie → proxies to FastAPI /admin/ai-command/execute. FastAPI re-runs
 * the whitelist validator on every call (don't trust the client) and
 * returns one of:
 *   - 200 { status: "executed", result }
 *   - 200 { status: "requires_confirm", reason }
 *   - 200 { status: "rejected", reason }   (whitelist or param-clamp fail)
 *
 * Auth:
 *   - Reads the admin JWT from the signed httpOnly cookie.
 *
 * Errors:
 *   - 405 — non-POST
 *   - 400 — malformed JSON / missing action
 *   - 401 — no admin cookie
 *   - 502 — FastAPI unreachable
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { getAdminJwt } from "~/lib/admin-session.server";
import { postExecuteCommand } from "~/lib/fastapi.server";

interface ExecutePayload {
  action?: string;
  params?: Record<string, unknown>;
  confirmed?: boolean;
  action_id?: string;        // accepted for forward-compat, ignored
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return jsonError(405, "Method Not Allowed");
  }

  // ─── 1. Parse + validate body ─────────────────────────────────────
  let payload: ExecutePayload;
  try {
    payload = (await request.json()) as ExecutePayload;
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const actionName = (payload.action ?? "").trim();
  if (!actionName) {
    return jsonError(400, "action is required.");
  }

  // ─── 2. Verify admin JWT cookie ───────────────────────────────────
  const adminJwt = await getAdminJwt(request);
  if (!adminJwt) {
    return jsonError(401, "Admin login required.");
  }

  // ─── 3. Forward to FastAPI /admin/ai-command/execute ─────────────
  // The whitelist validator runs server-side; we forward the user's
  // `confirmed` flag verbatim. UI must show a confirm modal for any
  // action that came back as `requires_confirm` from parse-command.
  try {
    const result = await postExecuteCommand(
      adminJwt,
      {
        action: actionName,
        params: payload.params ?? {},
        confirmed: payload.confirmed === true,
      },
      { fastApiUrl: context.env.FASTAPI_URL, request },
    );
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream error";
    return jsonError(502, `FastAPI execute failed: ${message}`);
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
