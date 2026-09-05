/**
 * Security headers — FINAL_PATCHES_V3 Fix 9 + PORTALS_AND_SECURITY.md.
 *
 * Applied to every response from the Oxygen worker (and the Vite dev
 * server) so we don't depend on Shopify / Cloudflare config to harden
 * the storefront.
 *
 * CSP is intentionally narrow: only same-origin + Shopify CDN + Google
 * Fonts. Inline styles/scripts are allowed because Remix + Tailwind
 * generate them at build time; revisit if you migrate away from either.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    // Remix inlines script tags at runtime for the entry chunk; allow 'self'
    // + Shopify CDN for Hydrogen's hydration. No third-party analytics yet.
    "script-src 'self' 'unsafe-inline' https://cdn.shopify.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://cdn.shopify.com https://*.myshopify.com",
    // Connect targets: Shopify Storefront + Admin GraphQL + FastAPI on
    // both domains. R2 bucket for product assets.
    "connect-src 'self' https://*.myshopify.com https://api.glassskincare.co https://api.glassskincare.in https://assets.glassskincare.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

/** Merge security headers into an existing Response, overriding if the
 *  response already set any of the same keys (defensive — we want our
 *  hardened values, not anything Remix/Hydrogen might have computed). */
export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
