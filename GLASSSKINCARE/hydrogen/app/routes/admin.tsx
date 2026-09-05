/**
 * admin.tsx
 * ----------
 * GET /admin — admin dashboard shell with floating AI command bar.
 *
 * Auth model:
 *   - Loader verifies the admin JWT cookie via `getAdminJwtWithSecret`.
 *     Missing cookie → redirect to /admin/login.
 *
 * Composition:
 *   - Header strip — total users, conversations last 7d, low-stock count
 *     (fetched server-side from FastAPI `/admin/dashboard`).
 *   - Orders table — first 20 Shopify orders via `/admin/orders`.
 *   - Floating command button + cmd-K modal — calls
 *     `/api/admin/parse-command`, then on confirm `/api/admin/execute`.
 *
 * Why a full-page route (vs. nested layouts):
 *   - The admin shell is visually distinct from the storefront and
 *     doesn't need product/cart context. A flat route keeps the auth
 *     guard + data loaders in one file.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Outlet, useLoaderData, useLocation } from "@remix-run/react";
import {
  FastApiError,
} from "~/lib/types";
import {
  getAdminDashboard,
  getAdminOrders,
} from "~/lib/fastapi.server";
import {
  getAdminJwtWithSecret,
  clearAdminJwtWithSecret,
} from "~/lib/admin-session.server";

export const meta: MetaFunction = () => [
  { title: "Admin — Glass Skincare" },
  { name: "robots", content: "noindex,nofollow" },
];

interface DashboardData {
  total_users: number;
  conversations_last_7d: number;
  low_stock_products: Array<Record<string, unknown>>;
}

interface OrderRow {
  id: string;
  name: string;
  created_at: string;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  line_items: Array<{ id: string; title: string; quantity: number; price: string }>;
}

interface AdminLoaderData {
  email: string; // unused placeholder so we can pass-through identity later
  dashboard: DashboardData;
  orders: OrderRow[];
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  // Skip auth guard when we're already on the login page — otherwise
  // missing/stale cookie → redirect("/admin/login") → this loader runs
  // again → redirect → ERR_TOO_MANY_REDIRECTS.
  const url = new URL(request.url);
  if (url.pathname === "/admin/login") {
    return null;
  }

  const sessionSecret = context.env.SESSION_SECRET ?? "";
  if (!sessionSecret) {
    throw redirect("/admin/login");
  }
  const adminJwt = await getAdminJwtWithSecret(request, sessionSecret);
  if (!adminJwt) {
    throw redirect("/admin/login");
  }

  // Fetch dashboard counts + recent orders. Tolerate failure so a missing
  // SHOPIFY_ADMIN_API_TOKEN (orders endpoint) or backend hiccup doesn't
  // 500 the whole admin shell — render empty data with an inline note.
  let dashboard: DashboardData = {
    total_users: 0,
    conversations_last_7d: 0,
    low_stock_products: [],
  };
  let orders: OrderRow[] = [];
  let fetchError: string | null = null;

  try {
    const [d, o] = await Promise.all([
      getAdminDashboard(adminJwt, {
        fastApiUrl: context.env.FASTAPI_URL,
        request,
      }),
      getAdminOrders(adminJwt, {
        fastApiUrl: context.env.FASTAPI_URL,
        request,
      }),
    ]);
    dashboard = {
      total_users: d.total_users ?? 0,
      conversations_last_7d: d.conversations_last_7d ?? 0,
      low_stock_products: Array.isArray(d.low_stock_products)
        ? d.low_stock_products
        : [],
    };
    orders = Array.isArray(o?.orders) ? (o.orders as OrderRow[]) : [];
  } catch (err) {
    fetchError =
      err instanceof FastApiError
        ? `Backend returned ${err.status}.`
        : "Could not load dashboard data.";
    // 401/403 → upstream says our JWT is stale (e.g. backend JWT_SECRET
    // rotated between dev sessions). Clear the cookie on the way out so
    // /admin/login doesn't bounce us right back here → loop.
    if (err instanceof FastApiError && (err.status === 401 || err.status === 403)) {
      const clearCookie = await clearAdminJwtWithSecret(sessionSecret);
      throw redirect("/admin/login", {
        headers: { "Set-Cookie": clearCookie },
      });
    }
  }

  return json<AdminLoaderData>({
    email: "admin",
    dashboard,
    orders,
    // attach fetchError via header trick? simpler: bake into a side field.
    // (Kept the JSON shape tight for clarity — UI shows a subtle note.)
    ...({ fetchError } as object),
  });
}

// ─── Page ───────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const location = useLocation();

  // For child routes (/admin/login, /admin/theme, etc.) render the
  // child's component tree directly — the dashboard UI only renders
  // when we're on /admin exactly.
  if (location.pathname !== "/admin") {
    return <Outlet />;
  }

  const data = useLoaderData<typeof loader>() as AdminLoaderData & {
    fetchError?: string | null;
  };
  const [cmdOpen, setCmdOpen] = useState(false);

  // Cmd-K / Ctrl-K toggles the command palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      } else if (e.key === "Escape" && cmdOpen) {
        setCmdOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cmdOpen]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-glass-cream to-glass-sand/30">
      {/* ─── Top bar ─────────────────────────────────────────────── */}
      <header className="glass-card-lg sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full glass-card flex items-center justify-center">
            <LogoMark />
          </div>
          <div>
            <h1 className="font-display text-xl text-glass-charcoal leading-none">
              Admin
            </h1>
            <p className="text-[11px] text-glass-brown mt-0.5 tracking-wider uppercase">
              Glass Skincare
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCmdOpen(true)}
          aria-label="Open AI command bar"
          className="glass-button flex items-center gap-3 px-4 py-2 text-sm text-glass-charcoal active:scale-[0.98] transition-transform"
        >
          <SparkleIcon />
          <span className="hidden sm:inline">Ask the store anything…</span>
          <span className="sm:hidden">Ask…</span>
          <span className="glass-pill text-[10px] font-mono py-0.5 px-1.5 text-glass-brown">
            ⌘K
          </span>
        </button>

        {/* Sign out — clear admin cookie + bounce to login. */}
        <button
          type="button"
          onClick={async () => {
            try {
              await fetch("/api/admin/logout", { method: "POST" });
            } catch {
              // Even if the network call fails, hard-navigate so the
              // browser drops in-memory admin state.
            }
            window.location.href = "/admin/login";
          }}
          className="ml-2 glass-button px-3 py-2 text-xs text-glass-charcoal active:scale-[0.98] transition-transform"
        >
          Sign out
        </button>
      </header>

      {/* ─── Stat strip ─────────────────────────────────────────── */}
      <section className="px-6 pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total users"
            value={data.dashboard.total_users.toLocaleString()}
            hint="registered across .co + .in"
          />
          <StatCard
            label="Conversations (7d)"
            value={data.dashboard.conversations_last_7d.toLocaleString()}
            hint="AI chat + quiz sessions"
          />
          <StatCard
            label="Low-stock SKUs"
            value={data.dashboard.low_stock_products.length.toLocaleString()}
            hint={data.dashboard.low_stock_products.length > 0 ? "needs restock" : "all healthy"}
            tone={
              data.dashboard.low_stock_products.length > 0 ? "warn" : "ok"
            }
          />
        </div>

        {data.fetchError && (
          <div className="mt-4 glass-card border border-amber-300/60 text-sm text-amber-800 px-4 py-2 rounded-xl">
            {data.fetchError} Showing cached values where available.
          </div>
        )}
      </section>

      {/* ─── Orders table ────────────────────────────────────────── */}
      <section className="px-6 pt-6 pb-32">
        <div className="glass-card-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg text-glass-charcoal">
              Recent orders
            </h2>
            <span className="glass-pill text-xs text-glass-brown">
              {data.orders.length} order{data.orders.length === 1 ? "" : "s"}
            </span>
          </div>

          {data.orders.length === 0 ? (
            <EmptyOrders />
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-glass-brown border-b border-glass-sand/40">
                    <th className="px-2 py-2 font-medium">Order</th>
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Items</th>
                    <th className="px-2 py-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr
                      key={o.id}
                      className="border-b border-glass-sand/20 last:border-0"
                    >
                      <td className="px-2 py-3 font-mono text-glass-charcoal">
                        {o.name}
                      </td>
                      <td className="px-2 py-3 text-glass-brown">
                        {formatDate(o.created_at)}
                      </td>
                      <td className="px-2 py-3">
                        <StatusPill
                          financial={o.financial_status}
                          fulfillment={o.fulfillment_status}
                        />
                      </td>
                      <td className="px-2 py-3 text-glass-brown">
                        {summariseItems(o.line_items)}
                      </td>
                      <td className="px-2 py-3 text-right font-mono text-glass-charcoal">
                        {o.total_price}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ─── Floating command bar ────────────────────────────────── */}
      {cmdOpen && <CommandBar onClose={() => setCmdOpen(false)} />}
    </div>
  );
}

// ─── StatCard ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  hint,
  tone = "ok",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn";
}) {
  const toneColor =
    tone === "warn"
      ? "border-amber-300/60 text-amber-800"
      : "border-glass-sand/30 text-glass-charcoal";
  return (
    <div className={`glass-card-lg p-5 ${toneColor}`}>
      <div className="text-[11px] uppercase tracking-wider text-glass-brown">
        {label}
      </div>
      <div className="font-display text-3xl text-glass-charcoal mt-2 leading-none">
        {value}
      </div>
      {hint && (
        <div className="text-xs text-glass-brown mt-2">{hint}</div>
      )}
    </div>
  );
}

// ─── Status pill ────────────────────────────────────────────────────────

function StatusPill({
  financial,
  fulfillment,
}: {
  financial: string;
  fulfillment: string | null;
}) {
  const tone =
    financial === "PAID"
      ? "bg-emerald-400/30 text-emerald-900 border-emerald-400/40"
      : financial === "REFUNDED" || financial === "VOIDED"
        ? "bg-rose-300/30 text-rose-900 border-rose-300/40"
        : financial === "PENDING"
          ? "bg-amber-300/30 text-amber-900 border-amber-300/40"
          : "bg-glass-sand/40 text-glass-charcoal border-glass-sand/40";
  return (
    <span
      className={`inline-flex items-center gap-1 glass-pill text-[11px] px-2 py-0.5 border ${tone}`}
    >
      <span className="font-medium">{financial}</span>
      {fulfillment && fulfillment !== "NULL" && (
        <span className="text-glass-brown">· {fulfillment}</span>
      )}
    </span>
  );
}

function summariseItems(
  items: Array<{ title: string; quantity: number }>,
): string {
  if (items.length === 0) return "—";
  const totalQty = items.reduce((sum, it) => sum + it.quantity, 0);
  const first = items[0]?.title ?? "";
  if (items.length === 1) return `${totalQty}× ${first}`;
  return `${totalQty}× ${first} +${items.length - 1} more`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function EmptyOrders() {
  return (
    <div className="text-center py-10">
      <div className="glass-card inline-flex flex-col items-center gap-2 px-6 py-6">
        <BoxIcon />
        <div className="font-display text-lg text-glass-charcoal">
          No orders to show
        </div>
        <p className="text-xs text-glass-brown max-w-xs">
          Either Shopify admin credentials aren't configured or there have
          been no recent orders.
        </p>
      </div>
    </div>
  );
}

// ─── Command bar modal ──────────────────────────────────────────────────

interface ParsedAction {
  action: string;
  description: string;
  requires_confirmation: boolean;
  params: Record<string, unknown>;
  estimated_impact?: string | null;
}

interface CommandBarProps {
  onClose: () => void;
}

function CommandBar({ onClose }: CommandBarProps) {
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<ParsedAction | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executed, setExecuted] = useState<null | {
    ok: boolean;
    message: string;
    stub?: boolean;
  }>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Lock body scroll while modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    setExecuted(null);
    try {
      const res = await fetch("/api/admin/parse-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: trimmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Parse failed (${res.status}).`);
        setPending(false);
        return;
      }
      const body = (await res.json()) as ParsedAction;
      setParsed(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setPending(false);
    }
  }

  async function confirm() {
    if (!parsed) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: parsed.action,
          params: parsed.params,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        stub?: boolean;
        error?: string;
      };
      setExecuted({
        ok: res.ok && body.ok !== false,
        message:
          body.message ?? body.error ?? `Action returned ${res.status}.`,
        stub: body.stub,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setPending(false);
    }
  }

  function cancel() {
    setParsed(null);
    setExecuted(null);
    setError(null);
  }

  function close() {
    setParsed(null);
    setExecuted(null);
    setError(null);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI command bar"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close command bar"
        onClick={close}
        className="absolute inset-0 bg-glass-charcoal/30 backdrop-blur-md"
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl backdrop-blur-2xl bg-glass-blur/90 border border-glass-sand/50 shadow-glass-lg rounded-2xl overflow-hidden">
        {/* Input row */}
        <form
          onSubmit={submit}
          className="flex items-center gap-3 px-5 py-4 border-b border-glass-sand/30"
        >
          <SparkleIcon />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the store anything…"
            disabled={pending}
            className="flex-1 bg-transparent text-base text-glass-charcoal placeholder:text-glass-brown/60 focus:outline-none disabled:opacity-60"
          />
          <span className="glass-pill text-[10px] font-mono py-0.5 px-1.5 text-glass-brown">
            ⌘K
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="h-7 w-7 rounded-full hover:bg-glass-sand/40 flex items-center justify-center text-glass-brown"
          >
            <CloseIcon />
          </button>
        </form>

        {/* Body */}
        <div className="px-5 py-5 min-h-[180px] max-h-[60vh] overflow-y-auto">
          {!parsed && !error && (
            <EmptyCommand onPick={(s) => setInput(s)} />
          )}

          {error && (
            <div className="glass-card border border-red-300/60 text-sm text-red-700 px-3 py-2 rounded-xl">
              {error}
            </div>
          )}

          {parsed && !executed && (
            <ParsedView
              parsed={parsed}
              pending={pending}
              onConfirm={confirm}
              onCancel={cancel}
            />
          )}

          {executed && <ExecutedView executed={executed} onDone={close} />}
        </div>
      </div>
    </div>
  );
}

// ─── Empty state + suggestions ──────────────────────────────────────────

const SUGGESTIONS = [
  "Show pending orders",
  "Refund order #1042",
  "Export customers to CSV",
  "Show low stock products",
  "Get analytics for last 7 days",
];

function EmptyCommand({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-glass-brown mb-3">
        Try a command
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="glass-button text-left px-3 py-2 text-sm text-glass-charcoal active:scale-[0.98] transition-transform"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Parsed action view ─────────────────────────────────────────────────

function ParsedView({
  parsed,
  pending,
  onConfirm,
  onCancel,
}: {
  parsed: ParsedAction;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const requiresConfirm = parsed.requires_confirmation;
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-glass-brown">
            Parsed action
          </div>
          <div className="font-display text-xl text-glass-charcoal mt-1">
            {parsed.action}
          </div>
        </div>
        {requiresConfirm ? (
          <span className="glass-pill text-[11px] px-2 py-0.5 border border-amber-300/60 text-amber-800 bg-amber-100/40">
            Confirm required
          </span>
        ) : (
          <span className="glass-pill text-[11px] px-2 py-0.5 border border-emerald-300/60 text-emerald-800 bg-emerald-100/40">
            Safe action
          </span>
        )}
      </div>

      <p className="mt-3 text-sm text-glass-charcoal/90 leading-relaxed">
        {parsed.description}
      </p>

      {parsed.estimated_impact && (
        <div className="mt-3 glass-card px-3 py-2 text-xs text-glass-brown">
          <span className="font-medium text-glass-charcoal">Impact:</span>{" "}
          {parsed.estimated_impact}
        </div>
      )}

      {parsed.params && Object.keys(parsed.params).length > 0 && (
        <details className="mt-3">
          <summary className="text-xs uppercase tracking-wider text-glass-brown cursor-pointer">
            Params ({Object.keys(parsed.params).length})
          </summary>
          <pre className="mt-2 text-xs glass-card p-3 rounded-lg overflow-x-auto font-mono text-glass-charcoal/90">
            {JSON.stringify(parsed.params, null, 2)}
          </pre>
        </details>
      )}

      <div className="mt-5 flex items-center gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="glass-button px-4 py-2 text-sm text-glass-charcoal active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className={`px-4 py-2 text-sm font-medium rounded-xl active:scale-[0.98] transition-transform disabled:opacity-60 ${
            requiresConfirm
              ? "bg-amber-400/90 text-amber-950 border border-amber-500/60 hover:bg-amber-400"
              : "glass-button text-glass-charcoal"
          }`}
        >
          {pending
            ? "Working…"
            : requiresConfirm
              ? "Confirm action"
              : "Execute"}
        </button>
      </div>
    </div>
  );
}

// ─── Executed view ──────────────────────────────────────────────────────

function ExecutedView({
  executed,
  onDone,
}: {
  executed: { ok: boolean; message: string; stub?: boolean };
  onDone: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {executed.ok ? (
          <CheckIcon />
        ) : (
          <AlertIcon />
        )}
        <div className="font-display text-lg text-glass-charcoal">
          {executed.ok ? "Action completed" : "Action returned"}
        </div>
      </div>
      <p className="mt-2 text-sm text-glass-charcoal/90">{executed.message}</p>
      {executed.stub && (
        <p className="mt-2 text-xs text-glass-brown">
          (Stub response — backend executor ships in Phase 2.)
        </p>
      )}
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onDone}
          className="glass-button px-4 py-2 text-sm text-glass-charcoal active:scale-[0.98] transition-transform"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Icons (inline SVG, no deps) ────────────────────────────────────────

function LogoMark() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 text-glass-brown"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 text-glass-brown"
    >
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 text-emerald-600"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 text-amber-700"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6 text-glass-brown"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}