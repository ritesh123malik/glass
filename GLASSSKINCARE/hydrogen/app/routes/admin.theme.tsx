/**
 * /admin/theme — color picker editor for the live palette.
 *
 * Loader fetches current tokens from FastAPI GET /admin/theme (no auth,
 * used by root loader too). Action submits to /api/admin/theme which
 * proxies PUT /admin/theme with the admin JWT.
 *
 * After save, the admin root loader on next request refreshes tokens
 * — no manual cache bust needed for the demo. A future version can
 * add an explicit revalidate.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { fetchThemeTokens } from "~/lib/theme.server";

export const meta: MetaFunction = () => [{ title: "Theme • Glass Skincare Admin" }];

export async function loader({ context }: LoaderFunctionArgs) {
  // Public read; reuse the same helper the root loader uses so editors
  // see exactly what storefront renders.
  const tokens = await fetchThemeTokens(context.env.FASTAPI_URL);
  return json({ tokens });
}

interface ActionResult {
  ok: boolean;
  message: string;
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "reset") {
    const res = await fetch(new URL("/api/admin/theme", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    return json<ActionResult>({
      ok: res.ok,
      message: res.ok ? "Theme reset to defaults." : `Reset failed (${res.status})`,
    });
  }

  // Save: rebuild tokens dict from form. Each row is `token_<key>=<color>`.
  const tokens: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (k.startsWith("token_") && typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)) {
      tokens[k.slice("token_".length)] = v;
    }
  }
  if (Object.keys(tokens).length === 0) {
    return json<ActionResult>({ ok: false, message: "No valid color tokens submitted." }, { status: 422 });
  }
  const res = await fetch(new URL("/api/admin/theme", request.url), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ tokens }),
  });
  return json<ActionResult>({
    ok: res.ok,
    message: res.ok ? `Saved ${Object.keys(tokens).length} tokens.` : `Save failed (${res.status})`,
  });
}

const TOKEN_ORDER = [
  "cream", "white", "tan", "brown", "ink", "muted",
  "accent", "accent-2", "gold", "peach", "rose", "leaf", "sky", "lavender",
];

export default function AdminThemePage() {
  const { tokens } = useLoaderData<typeof loader>();
  const action = useActionData<ActionResult>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";

  // Merge: keep server tokens; fall back to known defaults for any missing.
  const values: Record<string, string> = {};
  for (const k of TOKEN_ORDER) values[k] = tokens[k] ?? "#000000";

  return (
    <main className="min-h-screen bg-glass-cream text-glass-brown font-sans p-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-display font-black text-glass-brown">Theme palette</h1>
          <p className="text-glass-muted mt-1">
            Pick colors per token. Saves land instantly on the storefront via SSR injection.
          </p>
        </header>

        {action && (
          <div
            role="status"
            className={`mb-6 px-4 py-3 rounded-2xl border ${
              action.ok
                ? "bg-glass-leaf/15 border-glass-leaf/30 text-glass-leaf"
                : "bg-glass-accent/10 border-glass-accent/30 text-glass-accent"
            }`}
          >
            {action.message}
          </div>
        )}

        <Form method="post" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TOKEN_ORDER.map((key) => (
            <label
              key={key}
              className="glass-card flex items-center gap-3 p-4 rounded-2xl border border-glass-brown/10"
            >
              <input
                type="color"
                name={`token_${key}`}
                defaultValue={values[key]}
                className="w-12 h-12 rounded-xl border border-glass-brown/15 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-glass-brown">{key}</div>
                <div className="text-xs text-glass-muted font-mono">{values[key]}</div>
              </div>
            </label>
          ))}

          <div className="sm:col-span-2 flex items-center gap-3 mt-2">
            <button
              type="submit"
              name="intent"
              value="save"
              disabled={busy}
              className="px-6 py-3 rounded-2xl bg-glass-accent text-white font-bold disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save palette"}
            </button>
            <button
              type="submit"
              name="intent"
              value="reset"
              disabled={busy}
              className="px-6 py-3 rounded-2xl bg-glass-cream border border-glass-brown/15 text-glass-brown font-bold disabled:opacity-50"
            >
              Reset to defaults
            </button>
          </div>
        </Form>
      </div>
    </main>
  );
}
