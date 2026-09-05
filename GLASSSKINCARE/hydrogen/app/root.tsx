import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { DermatologistChat } from "./components/ai/DermatologistChat";
import { LocalCartProvider } from "./components/cart/LocalCartProvider";
import { CartDrawer } from "./components/layout/CartDrawer";
import { CartDrawerProvider } from "./components/layout/cart-context";
import { Footer } from "./components/layout/Footer";
import { Header } from "./components/layout/Header";
import { fetchThemeTokens } from "./lib/theme.server";
import tailwindHref from "./tailwind.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: tailwindHref },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  // Raleway — body sans-serif (default)
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Raleway:wght@200;300;400;500;600;700;800;900&display=swap",
  },
  // Playfair Display — editorial serif headings
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700&display=swap",
  },
  // Archivo Black — heavy display
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap",
  },
  // Baloo 2 — rounded accent
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&display=swap",
  },
];

/**
 * Root loader: pull current theme tokens from FastAPI for SSR.
 * Falls back to empty tokens on error — Tailwind's CSS vars in
 * tailwind.css still apply the built-in defaults.
 */
export async function loader({ context }: LoaderFunctionArgs) {
  const tokens = await fetchThemeTokens(context.env.FASTAPI_URL);
  return { tokens };
}

export function Layout({ children }: { children: React.ReactNode }) {
  // Root loader returns {tokens} but on routes where Remix renders this
  // Layout without a root loader (e.g. resource routes, error boundaries,
  // or auth-callback flows that bypass the root), useLoaderData() can be
  // undefined. Default to {} so destructure never crashes.
  const data = useLoaderData<typeof loader>() as
    | { tokens?: Record<string, string> }
    | undefined;
  const tokens = data?.tokens ?? {};

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {/* Live theme injection — admin-editable palette overrides
            Tailwind defaults at runtime via CSS custom properties. */}
        {Object.keys(tokens).length > 0 && (
          <style
            dangerouslySetInnerHTML={{
              __html: `:root{${Object.entries(tokens)
                .map(([k, v]) => `--glass-${k}:${v}`)
                .join(";")}}`,
            }}
          />
        )}
      </head>
      {/* glass-cream body bg; opt-in .neobrutalism on a page swaps the palette */}
      <body className="font-sans antialiased text-glass-charcoal bg-glass-cream">
        {/*
          LocalCartProvider powers a local-first cart that works with or
          without a live Shopify storefront: lines persist in localStorage
          and are hydrated instantly, so Add to Cart, the drawer, /cart and
          /checkout all work in dev/demo even though the env storefront
          credentials are placeholders.
        */}
        <LocalCartProvider>
          <StorefrontShell>{children}</StorefrontShell>
        </LocalCartProvider>
        {/* Floating AI dermatologist chat widget — available on every route. */}
        <DermatologistChat />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function StorefrontShell({ children }: { children: React.ReactNode }) {
  return (
    <CartDrawerProvider>
      <div className="flex min-h-screen flex-col overflow-x-hidden">
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
      </div>
      <CartDrawer />
    </CartDrawerProvider>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="font-sans antialiased text-glass-charcoal bg-glass-cream min-h-screen flex flex-col justify-center items-center p-6 text-center">
        <div className="max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-200">
          <h1 className="text-3xl font-serif font-bold text-red-600 mb-4">Something went wrong</h1>
          <p className="text-sm text-gray-600 mb-6">
            Unable to load product catalog from Shopify. Please check your network connection or Storefront API configuration.
          </p>
          <a
            href="/"
            className="inline-block bg-glass-charcoal text-white px-6 py-3 rounded-lg font-medium hover:bg-black transition"
          >
            Reload Home Page
          </a>
        </div>
        <Scripts />
      </body>
    </html>
  );
}