import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { ProductCard } from "~/components/consumer/ProductCard";
import type { ProductCardProduct } from "~/components/consumer/ProductCard";

export const meta: MetaFunction = () => [
  { title: "All Products — GlassSkin" },
  { name: "description", content: "Shop our feel-good formulations." },
];

const MOCK_PRODUCTS: ProductCardProduct[] = [
  {
    id: "gid://shopify/Product/1",
    title: "Glass Skin Dew Drops",
    handle: "glass-skin-dew-drops",
    description: "Hydrating hyaluronic acid & niacinamide serum for instant glass skin glow.",
    featuredImage: {
      url: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80",
      altText: "Glass Skin Dew Drops",
    },
    priceRange: {
      minVariantPrice: { amount: "38.00", currencyCode: "USD" },
    },
  },
  {
    id: "gid://shopify/Product/2",
    title: "Barrier Bounce Cream",
    handle: "barrier-bounce-cream",
    description: "Ceramide lipid moisture glaze to repair and protect delicate skin barriers.",
    featuredImage: {
      url: "https://images.unsplash.com/photo-1608248597261-e4d990f31623?auto=format&fit=crop&w=600&q=80",
      altText: "Barrier Bounce Cream",
    },
    priceRange: {
      minVariantPrice: { amount: "44.00", currencyCode: "USD" },
    },
  },
  {
    id: "gid://shopify/Product/3",
    title: "Peptide Glaze Cleanser",
    handle: "peptide-glaze-cleanser",
    description: "Gentle jelly-to-milk cleanser that lifts impurities without stripping skin.",
    featuredImage: {
      url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80",
      altText: "Peptide Glaze Cleanser",
    },
    priceRange: {
      minVariantPrice: { amount: "32.00", currencyCode: "USD" },
    },
  },
  {
    id: "gid://shopify/Product/4",
    title: "Luminous Night Elixir",
    handle: "luminous-night-elixir",
    description: "Overnight retinoid & squalane treatment for velvety smooth skin texture.",
    featuredImage: {
      url: "https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&w=600&q=80",
      altText: "Luminous Night Elixir",
    },
    priceRange: {
      minVariantPrice: { amount: "52.00", currencyCode: "USD" },
    },
  },
];

const PRODUCTS_QUERY = `#graphql
  query ProductsPage($first: Int!, $query: String) {
    products(first: $first, query: $query) {
      nodes {
        id
        title
        handle
        description
        featuredImage {
          url
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;

const SKIN_TYPE_FILTERS = [
  { label: "All", value: "" },
  { label: "Oily", value: "tag:skin_type:oily" },
  { label: "Dry", value: "tag:skin_type:dry" },
  { label: "Combo", value: "tag:skin_type:combination" },
  { label: "Sensitive", value: "tag:skin_type:sensitive" },
];

export async function loader({ context, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const skinType = url.searchParams.get("skin") ?? "";

  try {
    const { products } = await context.storefront.query<{
      products: { nodes: ProductCardProduct[] };
    }>(PRODUCTS_QUERY, {
      variables: {
        first: 24,
        query: skinType || undefined,
      },
    });

    if (products?.nodes && products.nodes.length > 0) {
      return { products: products.nodes, activeSkinType: skinType };
    }
  } catch (error) {
    console.warn("Storefront query failed, falling back to mock products:", error);
  }

  return { products: MOCK_PRODUCTS, activeSkinType: skinType };
}

export default function ProductsIndex() {
  const { products, activeSkinType } = useLoaderData<typeof loader>();

  return (
    <main className="w-full flex flex-col bg-brand-bg min-h-screen">
      <div className="mx-auto max-w-7xl px-6 py-12 w-full">
        {/* Page title */}
        <div className="mb-12 text-center">
          <span className="bg-brand-sky text-brand-text font-bold text-xs px-4 py-1.5 -rotate-2 mb-4 inline-block border-2 border-brand-text shadow-play">Shop All</span>
          <h1 className="font-display font-bold text-5xl md:text-7xl text-brand-text mb-4">Our Formulations</h1>
        </div>

        {/* Skin-type filter bar */}
        <div className="flex gap-4 flex-wrap justify-center mb-12">
          {SKIN_TYPE_FILTERS.map(({ label, value }) => {
            const isActive = activeSkinType === value;
            const href = value ? `/products?skin=${encodeURIComponent(value)}` : "/products";
            return (
              <a
                key={value}
                href={href}
                className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest border-2 border-brand-text transition-all ${
                  isActive
                    ? "bg-brand-magenta text-white shadow-play -translate-y-1"
                    : "bg-white text-brand-text hover:bg-brand-yellow hover:shadow-play hover:-translate-y-1"
                }`}
              >
                {label}
              </a>
            );
          })}
        </div>

        {/* Product grid */}
        {products.length > 0 ? (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="py-24 text-center">
            <p className="font-display font-bold text-3xl text-brand-text mb-6">No products found</p>
            <Link to="/products" className="bg-brand-accent text-white font-bold uppercase tracking-widest text-xs px-8 py-4 border-2 border-brand-text shadow-play hover:translate-y-1 hover:shadow-none transition-all">
              Clear Filters
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
