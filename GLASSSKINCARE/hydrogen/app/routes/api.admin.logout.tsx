/**
 * api.admin.logout.tsx
 * ---------------------
 * POST /api/admin/logout — clears the admin session cookie.
 *
 * Always returns 200 even if no cookie was present (idempotent —
 * clicking "Sign out" twice should never error). The browser-side
 * handler hard-navigates to /admin/login after a successful call.
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { clearAdminJwtWithSecret } from "~/lib/admin-session.server";

export async function action({ context }: ActionFunctionArgs) {
  const secret = context.env.SESSION_SECRET ?? "";
  if (!secret) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  const setCookie = await clearAdminJwtWithSecret(secret);
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", setCookie);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers,
  });
}

export function loader() {
  return new Response("Method Not Allowed", { status: 405 });
}
