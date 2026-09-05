/**
 * ProductCardAI.tsx
 * -----------------
 * AI-recommendations variant of the consumer ProductCard. Adds:
 *   - Match score pill ("94% match") — glass-pill, top-left overlay
 *   - Skin-type chips
 *   - Concerns-addressed chips
 *   - "Add to cart" link (Hydrogen <a to=...> — placeholder route)
 *
 * Reuses the iOS glassmorphism tokens (glass-card, glass-pill) so it slots
 * into the same visual system as the rest of the AI surface. For the
 * default neobrutalism theme, callers wrap the grid in `.neobrutalism`.
 *
 * Falls back to a regular `ProductCard` view when no `matchScore` is
 * passed (e.g. when AI metadata hasn't been hydrated yet).
 */
import { Link } from "@remix-run/react";
import { Money } from "@shopify/hydrogen";
import type { AIRecommendedProduct } from "~/routes/api.recommend";

export interface ProductCardAIProps {
  product: AIRecommendedProduct;
}

const MAX_CHIPS = 3;

export function ProductCardAI({ product }: ProductCardAIProps) {
  const {
    handle,
    title,
    description,
    featuredImage,
    priceRange,
    matchScore,
    skinTypes,
    concerns,
  } = product;

  const price = priceRange.minVariantPrice;
  // Hydrogen's <Money> wants a `MoneyV2` shape; our local `ShopifyProductSummary`
  // types currencyCode as plain `string`. Cast to keep the rest of the chain
  // narrow without importing Hydrogen's internal type.
  const moneyData = price as unknown as Parameters<typeof Money>[0]["data"];
  const scorePct = Math.round((matchScore ?? 0) * 100);

  return (
    <Link
      to={`/products/${handle}`}
      prefetch="intent"
      className="group relative flex flex-col glass-card rounded-2xl overflow-hidden shadow-glass hover:shadow-glass-xl hover:-translate-y-0.5 transition-all duration-300"
    >
      {/* Match-score pill (top-left, glass + backdrop blur) */}
      {typeof matchScore === "number" && (
        <div className="absolute top-3 left-3 z-10">
          <span className="glass-pill text-xs font-sans font-medium text-glass-charcoal backdrop-blur-glass shadow-glass-sm">
            {scorePct}% match
          </span>
        </div>
      )}

      {/* Product image */}
      <div className="aspect-square w-full overflow-hidden bg-glass-sand/30">
        {featuredImage ? (
          <img
            src={featuredImage.url}
            alt={featuredImage.altText ?? title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-sans text-xs uppercase tracking-widest text-glass-brown/60">
            No image
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-lg text-glass-charcoal leading-snug line-clamp-2 group-hover:text-glass-brown transition-colors">
            {title}
          </h3>
          <span className="flex-shrink-0 font-sans text-sm font-medium text-glass-charcoal bg-glass-tan/30 border border-glass-tan/40 px-3 py-1 rounded-full">
            <Money data={moneyData} />
          </span>
        </div>

        {/* Skin type chips */}
        {skinTypes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {skinTypes.slice(0, MAX_CHIPS).map((t) => (
              <span
                key={t}
                className="rounded-full bg-glass-sand/60 px-2.5 py-0.5 text-[10px] font-sans font-medium text-glass-brown uppercase tracking-widest"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Concerns addressed */}
        {concerns.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {concerns.slice(0, MAX_CHIPS).map((c) => (
              <span
                key={c}
                className="rounded-full border border-glass-tan/40 bg-glass-tan/10 px-2.5 py-0.5 text-[10px] font-sans font-medium text-glass-brown"
              >
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Description (truncated) */}
        {description && (
          <p className="font-sans text-xs text-glass-brown/80 line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}

        {/* Add to cart — Hydrogen prefetched <a> to a route that resolves
            the default variant + adds it via the cart cookie. Until that
            route is wired up, fall back to the PDP. */}
        <div className="mt-auto pt-3">
          <span className="inline-flex items-center gap-1.5 glass-button px-4 py-2 text-xs font-sans font-medium text-glass-charcoal group-hover:bg-glass-blur-strong transition-all">
            View product
            <ArrowRight />
          </span>
        </div>
      </div>
    </Link>
  );
}

function ArrowRight() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export default ProductCardAI;