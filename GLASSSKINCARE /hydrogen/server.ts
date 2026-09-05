/// <reference types="@shopify/oxygen-workers-types" />

import { createRequestHandler } from "@shopify/remix-oxygen";
import { createStorefrontClient } from "@shopify/hydrogen";
// @ts-ignore
import * as remixBuild from "virtual:remix/server-build";
import { withSecurityHeaders, SECURITY_HEADERS } from "~/lib/security-headers";

function isPlaceholder(value: string | undefined) {
  return !value || value.startsWith("your-") || value === "replace-with-random-64-char-string";
}

function storefrontConfigurationError(env: Env) {
  const missing = [
    ["PUBLIC_STORE_DOMAIN", env.PUBLIC_STORE_DOMAIN],
    ["PUBLIC_STOREFRONT_API_TOKEN", env.PUBLIC_STOREFRONT_API_TOKEN],
  ]
    .filter(([, value]) => isPlaceholder(value))
    .map(([name]) => name);

  if (missing.length === 0) return null;

  return new Response(
    `Shopify storefront is not configured. Replace the placeholder values for ${missing.join(
      ", ",
    )} in .env.\n\n` +
      "From the hydrogen directory, run:\n" +
      "  npx shopify hydrogen link\n" +
      "  npx shopify hydrogen env pull\n",
    {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        // Still emit security headers on the 503 placeholder.
        ...SECURITY_HEADERS,
      },
    },
  );
}

export default {
  async fetch(request: Request, env: Env, executionContext: ExecutionContext) {
    const configurationError = storefrontConfigurationError(env);
    if (configurationError) return withSecurityHeaders(configurationError);

    const { storefront } = createStorefrontClient({
      cache: await caches.open("hydrogen"),
      waitUntil: executionContext.waitUntil.bind(executionContext),
      i18n: { language: "EN", country: "US" },
      publicStorefrontToken: env.PUBLIC_STOREFRONT_API_TOKEN,
      privateStorefrontToken: env.PRIVATE_STOREFRONT_API_TOKEN,
      storeDomain: env.PUBLIC_STORE_DOMAIN,
      storefrontId: env.PUBLIC_STOREFRONT_ID,
      storefrontHeaders: {
        requestGroupId: null,
        buyerIp: null,
        buyerIpSig: null,
        cookie: request.headers.get("cookie"),
        purpose: request.headers.get("purpose"),
      },
    });

    const handleRequest = createRequestHandler({
      build: remixBuild,
      mode: process.env.NODE_ENV,
      getLoadContext: () => ({ storefront, env }),
    });

    const response = await handleRequest(request);
    return withSecurityHeaders(response);
  },
};
