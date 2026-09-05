/**
 * theme.server.ts
 * ---------------
 * Server-only helpers for fetching the admin-managed theme palette
 * from FastAPI. Used by the root loader for SSR injection of CSS
 * custom properties so every page picks up the latest palette without
 * a client-side flash.
 *
 * Why server-only:
 *   - Reads FASTAPI_URL from context.env (not process.env)
 *   - Network call must run on the Oxygen worker, not in the browser
 *   - The .server.ts suffix keeps it out of the client bundle
 */

interface ThemeResponse {
  name: string;
  tokens: Record<string, string>;
  updated_at: string;
}

/**
 * Fetch current theme tokens. Returns an empty object on any error
 * so the page still renders with Tailwind's hardcoded defaults.
 */
export async function fetchThemeTokens(
  fastApiUrl: string | undefined,
): Promise<Record<string, string>> {
  if (!fastApiUrl) return {};
  try {
    const res = await fetch(`${fastApiUrl}/admin/theme`, {
      headers: { Accept: "application/json" },
      // 5s is plenty for a local FastAPI; falls back to defaults on miss
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return {};
    const data = (await res.json()) as ThemeResponse;
    return data.tokens ?? {};
  } catch {
    return {};
  }
}
