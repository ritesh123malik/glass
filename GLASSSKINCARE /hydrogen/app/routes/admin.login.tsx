/**
 * admin.login.tsx
 * ----------------
 * GET /admin/login — admin login page.
 *
 * Simple email + password form. Submits to /api/admin/login (JSON),
 * on success the API route sets a signed httpOnly cookie and the
 * client hard-navigates to /admin.
 *
 * Loader deliberately does NOT redirect authenticated users to /admin.
 * Earlier versions did (`if cookie present → redirect to /admin`),
 * but that created ERR_TOO_MANY_REDIRECTS whenever the cookie's JWT
 * was stale relative to FastAPI's current JWT_SECRET — /admin would
 * 401 the upstream call, bounce back here, bounce back to /admin, …
 * Login is now a pure "issue a fresh session" endpoint.
 */
import { useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader(_args: LoaderFunctionArgs) {
  return null;
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        // Hard navigation so loaders re-run with the new cookie.
        window.location.href = "/admin";
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `Login failed (${res.status}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-12 bg-gradient-to-b from-glass-cream to-glass-sand/40">
      <div className="glass-card-lg w-full max-w-md p-8 md:p-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-full glass-card flex items-center justify-center">
            <LogoMark />
          </div>
          <div>
            <h1 className="font-display text-2xl text-glass-charcoal leading-none">
              Admin Portal
            </h1>
            <p className="text-xs text-glass-brown mt-1">
              Glass Skincare operations console
            </p>
          </div>
        </div>

        <div className="glass-divider mb-6" />

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs uppercase tracking-wider text-glass-brown mb-2 font-medium"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              className="w-full glass-input px-4 py-3 text-sm text-glass-charcoal placeholder:text-glass-brown/50 focus:outline-none focus:ring-2 focus:ring-glass-tan/50 disabled:opacity-60"
              placeholder="admin@glassskincare.co"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs uppercase tracking-wider text-glass-brown mb-2 font-medium"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
              className="w-full glass-input px-4 py-3 text-sm text-glass-charcoal placeholder:text-glass-brown/50 focus:outline-none focus:ring-2 focus:ring-glass-tan/50 disabled:opacity-60"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="glass-card border border-red-300/60 text-sm text-red-700 px-3 py-2 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full glass-button px-4 py-3 text-sm font-medium text-glass-charcoal active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <span className="glass-pill text-xs text-glass-brown inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Secure admin session
          </span>
        </div>
      </div>
    </div>
  );
}

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
      className="h-5 w-5 text-glass-brown"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}