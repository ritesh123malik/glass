import { Link } from "@remix-run/react";
import { Money } from "@shopify/hydrogen";

export interface ProductCardProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  featuredImage: { url: string; altText: string | null } | null;
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
  };
}

interface ProductCardProps {
  product: ProductCardProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const { handle, title, featuredImage, priceRange } = product;
  const price = priceRange.minVariantPrice;

  return (
    <Link
      to={`/products/${handle}`}
      prefetch="intent"
      className="group block bg-white border-4 border-brand-text rounded-xl overflow-hidden shadow-play hover:translate-y-1 hover:shadow-none transition-all duration-200"
    >
      <div className="aspect-square overflow-hidden bg-brand-sky/20 border-b-4 border-brand-text">
        {featuredImage ? (
          <img
            src={featuredImage.url}
            alt={featuredImage.altText ?? title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-bold text-brand-text/50 uppercase text-xs tracking-widest">
            No image
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="font-display font-bold text-xl text-brand-text mb-2 line-clamp-1 group-hover:text-brand-magenta transition-colors">
          {title}
        </h3>
        <div className="text-sm font-extrabold text-brand-text bg-brand-yellow inline-block px-3 py-1 border-2 border-brand-text rounded-full">
          <Money data={price as any} />
        </div>
      </div>
    </Link>
  );
}
