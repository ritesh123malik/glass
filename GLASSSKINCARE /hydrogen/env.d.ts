/// <reference types="vite/client" />
/// <reference types="@remix-run/dev/vite/env" />
/// <reference types="@shopify/remix-oxygen" />
/// <reference types="@shopify/hydrogen" />
/// <reference types="@shopify/oxygen-workers-types" />

import type { Storefront } from "@shopify/hydrogen";

declare global {
  interface Env {
    PUBLIC_STORE_DOMAIN: string;
    PUBLIC_STOREFRONT_API_TOKEN: string;
    PRIVATE_STOREFRONT_API_TOKEN: string;
    PUBLIC_STOREFRONT_ID: string;
    SESSION_SECRET: string;
    FASTAPI_URL: string;
  }
}

declare module "@shopify/remix-oxygen" {
  export interface AppLoadContext {
    env: Env;
    storefront: Storefront;
  }
}

declare module "virtual:remix/server-build" {
  import type { ServerBuild } from "@remix-run/server-runtime";
  export const routes: ServerBuild["routes"];
  export const assets: ServerBuild["assets"];
  export const entry: ServerBuild["entry"];
  export const future: ServerBuild["future"];
  export const isSpaMode: ServerBuild["isSpaMode"];
  export const mode: ServerBuild["mode"];
  export const publicPath: ServerBuild["publicPath"];
  const serverBuild: ServerBuild;
  export default serverBuild;
}


