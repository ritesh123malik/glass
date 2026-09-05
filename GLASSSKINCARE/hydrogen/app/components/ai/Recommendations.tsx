/**
 * Recommendations.tsx
 * --------------------
 * AI-driven product grid. Hits `/api/recommend` on mount and renders the
 * returned handles as ProductCardAI tiles, each with a match-score pill,
 * skin-type chips, and concerns chips.
 *
 * Three render states:
 *   1. `loading`   — glass-card skeleton placeholders (3–6 cards)
 *   2. `empty`     — no products AND no skin profile → "Complete skin quiz"
 *                    CTA. No products BUT profile exists → "No matches yet"
 *                    muted state.
 *   3. `ready`     — grid of ProductCardAI tiles.
 *
 * Server-rendering: this component is client-only (it makes a fetch on
 * mount and uses state). SSR returns the skeleton; hydration swaps in the
 * real data. That avoids any hydration mismatch because no product
 * metadata is rendered on the server pass.
 */
import { useEffect, useState } from "react";
import { Link } from "@remix-run/react";
import type { SkinProfile } from "~/lib/types";
import type { AIRecommendedProduct } from "~/routes/api.recommend";
import { ProductCardAI } from "~/components/consumer/ProductCardAI";

export interface RecommendationsProps {
  /**
   * The current user's skin profile (from skin quiz, photo analysis, or
   * the Shopify customer metafield). Optional so the component can
   * render an empty-state CTA when the profile is missing.
   */
  skinProfile?: SkinProfile | null;
  /**
   * Shopify customer access token. When present, `/api/recommend` calls
   * FastAPI's pgvector search. When absent, the route falls back to a
   * curated handle list.
   */
  shopifyCustomerToken?: string;
  /** Optional heading shown above the grid. */
  title?: string;
  /** Optional eyebrow chip shown above the heading. */
  eyebrow?: string;
  /** Optional className for the outer section. */
  className?: string;
  /** Number of skeleton placeholders to render while loading. */
  skeletonCount?: number;
}

type FetchState =
  | { status: "loading" }
  | { status: "ready"; products: AIRecommendedProduct[]; source: string }
  | { status: "error"; message: string };

const DEFAULT_SKELETON_COUNT = 6;

export function Recommendations({
  skinProfile,
  shopifyCustomerToken,
  title = "Recommended for you",
  eyebrow = "AI Picks",
  className = "",
  skeletonCount = DEFAULT_SKELETON_COUNT,
}: RecommendationsProps) {
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const hasProfile = hasUsableProfile(skinProfile);

  useEffect(() => {
    // Skip the fetch entirely when there's nothing to recommend and no
    // auth — the empty state renders an immediate CTA instead.
    if (!hasProfile && !shopifyCustomerToken) {
      setState({ status: "ready", products: [], source: "none" });
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skinProfile: skinProfile ?? null,
            shopifyCustomerToken: shopifyCustomerToken ?? null,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          // 502 from the proxy = FastAPI down. Surface a soft error.
          const detail =
            res.status === 502
              ? "Our recommendation engine is taking a breather."
              : `Recommendation service returned ${res.status}.`;
          setState({ status: "error", message: detail });
          return;
        }

        const data = (await res.json()) as {
          products: AIRecommendedProduct[];
          source: string;
        };
        setState({
          status: "ready",
          products: data.products ?? [],
          source: data.source ?? "fallback",
        });
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setState({
          status: "error",
          message:
            err instanceof Error ? err.message : "Could not load recommendations.",
        });
      }
    })();

    return () => controller.abort();
  }, [skinProfile, shopifyCustomerToken, hasProfile]);

  return (
    <section
      aria-labelledby="ai-recommendations-heading"
      className={`w-full ${className}`}
    >
      <header className="mb-8 md:mb-10 text-center">
        <span className="inline-block bg-glass-tan/30 text-glass-brown text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full font-sans font-medium border border-glass-tan/40">
          {eyebrow}
        </span>
        <h2
          id="ai-recommendations-heading"
          className="font-serif text-3xl md:text-4xl text-glass-charcoal mt-4 leading-tight"
        >
          {title}
        </h2>
      </header>

      {state.status === "loading" && (
        <SkeletonGrid count={skeletonCount} />
      )}

      {state.status === "error" && <ErrorState message={state.message} />}

      {state.status === "ready" && state.products.length === 0 && (
        hasProfile ? (
          <EmptyState />
        ) : (
          <NoProfileState />
        )
      )}

      {state.status === "ready" && state.products.length > 0 && (
        <ul
          role="list"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {state.products.map((p) => (
            <li key={p.id} className="list-none">
              <ProductCardAI product={p} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────

function SkeletonGrid({ count }: { count: number }) {
  // Clamp to 3–6 per spec.
  const n = Math.min(6, Math.max(3, count));
  return (
    <ul
      role="list"
      aria-busy="true"
      aria-label="Loading recommendations"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {Array.from({ length: n }).map((_, i) => (
        <li key={i} className="list-none">
          <SkeletonCard />
        </li>
      ))}
    </ul>
  );
}

function SkeletonCard() {
  return (
    <div className="glass-card rounded-2xl overflow-hidden shadow-glass">
      <div className="aspect-square w-full bg-glass-sand/40 animate-pulse" />
      <div className="p-5 space-y-3">
        <div className="h-4 w-2/3 rounded-full bg-glass-sand/60 animate-pulse" />
        <div className="h-3 w-1/3 rounded-full bg-glass-sand/40 animate-pulse" />
        <div className="flex gap-2 mt-3">
          <div className="h-5 w-14 rounded-full bg-glass-sand/40 animate-pulse" />
          <div className="h-5 w-20 rounded-full bg-glass-sand/40 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass-card-lg rounded-3xl p-10 md:p-12 text-center shadow-glass-lg">
      <h3 className="font-serif text-2xl text-glass-charcoal mb-2">
        No matches yet
      </h3>
      <p className="font-sans text-sm text-glass-brown max-w-md mx-auto">
        We don't have a strong match for your profile yet. Add a few more
        products to your routine or retake the skin quiz with more detail.
      </p>
      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <Link
          to="/skin-quiz"
          className="glass-button px-6 py-3 text-sm font-sans font-medium text-glass-charcoal hover:shadow-glass transition-all active:scale-95"
        >
          Retake the skin quiz
        </Link>
        <Link
          to="/products"
          className="glass-button px-6 py-3 text-sm font-sans font-medium text-glass-charcoal hover:shadow-glass transition-all active:scale-95"
        >
          Browse all products
        </Link>
      </div>
    </div>
  );
}

function NoProfileState() {
  return (
    <div className="glass-card-lg rounded-3xl p-10 md:p-12 text-center shadow-glass-lg">
      <h3 className="font-serif text-2xl text-glass-charcoal mb-2">
        Complete skin quiz first
      </h3>
      <p className="font-sans text-sm text-glass-brown max-w-md mx-auto">
        Take our 5-step skin quiz or upload a selfie — our AI will build a
        routine and recommend products just for you.
      </p>
      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <Link
          to="/skin-quiz"
          className="glass-button px-6 py-3 text-sm font-sans font-medium text-glass-charcoal hover:shadow-glass transition-all active:scale-95"
        >
          Start the skin quiz
        </Link>
        <Link
          to="/analyze-skin"
          className="glass-button px-6 py-3 text-sm font-sans font-medium text-glass-charcoal hover:shadow-glass transition-all active:scale-95"
        >
          Analyze a selfie
        </Link>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="glass-card border border-red-300/60 text-sm text-red-700 px-5 py-4 rounded-2xl font-sans max-w-xl mx-auto text-center">
      {message}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/** A profile counts as "usable" if it has at least skin_type or concerns. */
function hasUsableProfile(profile?: SkinProfile | null): boolean {
  if (!profile) return false;
  if (profile.skin_type && profile.skin_type.trim().length > 0) return true;
  if (profile.concerns && profile.concerns.length > 0) return true;
  return false;
}

export default Recommendations;