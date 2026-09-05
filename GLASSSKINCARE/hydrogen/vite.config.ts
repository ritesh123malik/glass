import { defineConfig, loadEnv } from "vite";
import { hydrogen } from "@shopify/hydrogen/vite";
import { oxygen } from "@shopify/mini-oxygen/vite";
import { vitePlugin as remix } from "@remix-run/dev";
import tsconfigPaths from "vite-tsconfig-paths";
import * as fs from "node:fs";
import * as path from "node:path";

// Load .env into process.env at config time (Hydrogen dev's SSR loaders
// run in Node, not MiniOxygen worker, so they read process.env directly).
const envFile = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      hydrogen(),
      oxygen({
        env: {
          SESSION_SECRET: process.env.SESSION_SECRET ?? env.SESSION_SECRET ?? "",
          FASTAPI_URL: process.env.FASTAPI_URL ?? env.FASTAPI_URL ?? "http://localhost:8000",
          PUBLIC_STORE_DOMAIN:
            process.env.PUBLIC_STORE_DOMAIN ?? env.PUBLIC_STORE_DOMAIN ?? "",
          PUBLIC_STOREFRONT_API_TOKEN:
            process.env.PUBLIC_STOREFRONT_API_TOKEN ?? env.PUBLIC_STOREFRONT_API_TOKEN ?? "",
          PRIVATE_STOREFRONT_API_TOKEN:
            process.env.PRIVATE_STOREFRONT_API_TOKEN ?? env.PRIVATE_STOREFRONT_API_TOKEN ?? "",
          PUBLIC_STOREFRONT_ID:
            process.env.PUBLIC_STOREFRONT_ID ?? env.PUBLIC_STOREFRONT_ID ?? "",
        },
      }),
      remix({ presets: [hydrogen.preset()] }),
      tsconfigPaths(),
    ],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@remix-run/node": "@shopify/remix-oxygen",
    },
  },
  ssr: {
    noExternal: ["@shopify/remix-oxygen"],
  },
  };
});

