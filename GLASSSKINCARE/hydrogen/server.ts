import { createRequestHandler } from "@shopify/remix-oxygen";
import { createStorefrontClient } from "@shopify/hydrogen";
// @ts-ignore
import * as remixBuild from "virtual:remix/server-build";
import { withSecurityHeaders } from "~/lib/security-headers";

/**
 * Runtime-agnostic request handler.
 *
 * Runs on Shopify Oxygen (fetch(request, env, executionContext)) and on
 * Node.js hosts such as Vercel, where environment variables come from
 * process.env and there is no Workers `caches` / `executionContext`.
 */

type EnvLike = Record<string, string | undefined>;

function resolveEnv(env?: EnvLike): EnvLike {
  if (env && typeof env === "object" && Object.keys(env).length > 0) {
    return env;
  }
  return process.env as EnvLike;
}

function isPlaceholder(value: string | undefined) {
  return (
    !value ||
    value.startsWith("your-") ||
    value === "replace-with-random-64-char-string"
  );
}

/** Minimal in-memory Cache shim for runtimes without the Workers Cache API. */
const memoryCache = new Map<string, Response>();
const memoryCacheShim = {
  async match(request: RequestInfo | URL) {
    const key = String(request);
    const hit = memoryCache.get(key);
    return hit ? hit.clone() : undefined;
  },
  async put(request: RequestInfo | URL, response: Response) {
    memoryCache.set(String(request), response.clone());
  },
  async delete(request: RequestInfo | URL) {
    return memoryCache.delete(String(request));
  },
  async keys() {
    return [...memoryCache.keys()];
  },
} as unknown as Cache;

async function resolveCache(): Promise<Cache> {
  const g = globalThis as { caches?: { open(name: string): Promise<Cache> } };
  try {
    if (g.caches?.open) {
      return await g.caches.open("hydrogen");
    }
  } catch {
    /* fall through */
  }
  return memoryCacheShim;
}

const noopWaitUntil = (_promise: Promise<unknown>) => {};

async function handleRequest(request: Request, envArg?: EnvLike) {
  const env = resolveEnv(envArg);

  const missing = (["PUBLIC_STORE_DOMAIN", "PUBLIC_STOREFRONT_API_TOKEN"] as const)
    .filter((name) => isPlaceholder(env[name]))
    .map((name) => name);

  if (missing.length > 0) {
    // Demo / unconfigured mode: still boot so the UI renders with the
    // storefront's built-in mock product fallbacks instead of a 503 wall.
    console.warn(
      `[server] Storefront not configured (missing ${missing.join(", ")}). ` +
        `Running in demo mode with mock product data.`,
    );
  }

  const storeDomain = env.PUBLIC_STORE_DOMAIN || "mock-glassskincare.myshopify.com";
  const publicStorefrontToken = env.PUBLIC_STOREFRONT_API_TOKEN || "3b8f142c90e7145a90d8e21c90a1b2c3";

  const { storefront } = createStorefrontClient({
    cache: await resolveCache(),
    waitUntil: noopWaitUntil,
    i18n: { language: "EN", country: "US" },
    publicStorefrontToken,
    privateStorefrontToken: env.PRIVATE_STOREFRONT_API_TOKEN,
    storeDomain,
    storefrontId: env.PUBLIC_STOREFRONT_ID,
    storefrontHeaders: {
      requestGroupId: null,
      buyerIp: null,
      buyerIpSig: null,
      cookie: request.headers.get("cookie"),
      purpose: request.headers.get("purpose"),
    },
  });

  const handleRequest2 = createRequestHandler({
    build: remixBuild,
    mode: process.env.NODE_ENV ?? "production",
    getLoadContext: () => ({ storefront, env }),
  });

  const response = await handleRequest2(request);
  return withSecurityHeaders(response);
}

export default {
  async fetch(request: Request, env?: EnvLike) {
    return handleRequest(request, env);
  },
};
