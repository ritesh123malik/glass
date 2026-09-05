import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Money, VariantSelector } from "@shopify/hydrogen";
import { useState } from "react";
import { json } from "@remix-run/server-runtime";
import { ProductGallery } from "~/components/consumer/ProductGallery";
import { useLocalCart } from "~/components/cart/LocalCartProvider";
import { useCartDrawer } from "~/components/layout/cart-context";

interface Image {
  id: string;
  url: string;
  altText: string | null;
}

interface VariantOption {
  name: string;
  value: string;
}

interface ProductVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  selectedOptions: VariantOption[];
  price: { amount: string; currencyCode: string };
  compareAtPrice: { amount: string; currencyCode: string } | null;
  quantityAvailable: number | null;
}

interface Metafield {
  key: string;
  value: string;
}

interface Product {
  id: string;
  title: string;
  handle: string;
  description: string;
  descriptionHtml: string;
  images: { nodes: Image[] };
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
  };
  variants: { nodes: ProductVariant[] };
  options: { name: string; values: string[] }[];
  metafields: (Metafield | null)[];
}

const MOCK_PRODUCTS_MAP: Record<string, Product> = {
  "glass-skin-dew-drops": {
    id: "gid://shopify/Product/1",
    title: "Glass Skin Dew Drops",
    handle: "glass-skin-dew-drops",
    description: "Hydrating hyaluronic acid & niacinamide serum for instant glass skin glow.",
    descriptionHtml: "<p>Hydrating hyaluronic acid & niacinamide serum for instant glass skin glow.</p>",
    images: {
      nodes: [
        {
          id: "img1",
          url: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=1000&q=80",
          altText: "Glass Skin Dew Drops",
        },
      ],
    },
    priceRange: {
      minVariantPrice: { amount: "38.00", currencyCode: "USD" },
    },
    options: [{ name: "Size", values: ["30ml", "50ml"] }],
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/101",
          title: "30ml",
          availableForSale: true,
          selectedOptions: [{ name: "Size", value: "30ml" }],
          price: { amount: "38.00", currencyCode: "USD" },
          compareAtPrice: { amount: "45.00", currencyCode: "USD" },
          quantityAvailable: 12,
        },
        {
          id: "gid://shopify/ProductVariant/102",
          title: "50ml",
          availableForSale: true,
          selectedOptions: [{ name: "Size", value: "50ml" }],
          price: { amount: "54.00", currencyCode: "USD" },
          compareAtPrice: { amount: "65.00", currencyCode: "USD" },
          quantityAvailable: 8,
        },
      ],
    },
    metafields: [],
  },
  "barrier-bounce-cream": {
    id: "gid://shopify/Product/2",
    title: "Barrier Bounce Cream",
    handle: "barrier-bounce-cream",
    description: "Ceramide lipid moisture glaze to repair and protect delicate skin barriers.",
    descriptionHtml: "<p>Ceramide lipid moisture glaze to repair and protect delicate skin barriers.</p>",
    images: {
      nodes: [
        {
          id: "img2",
          url: "https://images.unsplash.com/photo-1608248597261-e4d990f31623?auto=format&fit=crop&w=1000&q=80",
          altText: "Barrier Bounce Cream",
        },
      ],
    },
    priceRange: {
      minVariantPrice: { amount: "44.00", currencyCode: "USD" },
    },
    options: [{ name: "Size", values: ["50ml"] }],
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/201",
          title: "50ml",
          availableForSale: true,
          selectedOptions: [{ name: "Size", value: "50ml" }],
          price: { amount: "44.00", currencyCode: "USD" },
          compareAtPrice: null,
          quantityAvailable: 15,
        },
      ],
    },
    metafields: [],
  },
  "peptide-glaze-cleanser": {
    id: "gid://shopify/Product/3",
    title: "Peptide Glaze Cleanser",
    handle: "peptide-glaze-cleanser",
    description: "Gentle jelly-to-milk cleanser that lifts impurities without stripping skin.",
    descriptionHtml: "<p>Gentle jelly-to-milk cleanser that lifts impurities without stripping skin.</p>",
    images: {
      nodes: [
        {
          id: "img3",
          url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1000&q=80",
          altText: "Peptide Glaze Cleanser",
        },
      ],
    },
    priceRange: {
      minVariantPrice: { amount: "32.00", currencyCode: "USD" },
    },
    options: [{ name: "Size", values: ["150ml"] }],
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/301",
          title: "150ml",
          availableForSale: true,
          selectedOptions: [{ name: "Size", value: "150ml" }],
          price: { amount: "32.00", currencyCode: "USD" },
          compareAtPrice: null,
          quantityAvailable: 20,
        },
      ],
    },
    metafields: [],
  },
  "luminous-night-elixir": {
    id: "gid://shopify/Product/4",
    title: "Luminous Night Elixir",
    handle: "luminous-night-elixir",
    description: "Overnight retinoid & squalane treatment for velvety smooth skin texture.",
    descriptionHtml: "<p>Overnight retinoid & squalane treatment for velvety smooth skin texture.</p>",
    images: {
      nodes: [
        {
          id: "img4",
          url: "https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&w=1000&q=80",
          altText: "Luminous Night Elixir",
        },
      ],
    },
    priceRange: {
      minVariantPrice: { amount: "52.00", currencyCode: "USD" },
    },
    options: [{ name: "Size", values: ["30ml"] }],
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/401",
          title: "30ml",
          availableForSale: true,
          selectedOptions: [{ name: "Size", value: "30ml" }],
          price: { amount: "52.00", currencyCode: "USD" },
          compareAtPrice: null,
          quantityAvailable: 5,
        },
      ],
    },
    metafields: [],
  },
};

const PRODUCT_QUERY = `#graphql
  query Product($handle: String!) {
    product(handle: $handle) {
      id
      title
      handle
      description
      descriptionHtml
      images(first: 8) {
        nodes {
          id
          url
          altText
        }
      }
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
      }
      options {
        name
        values
      }
      variants(first: 20) {
        nodes {
          id
          title
          availableForSale
          quantityAvailable
          price {
            amount
            currencyCode
          }
          compareAtPrice {
            amount
            currencyCode
          }
          selectedOptions {
            name
            value
          }
        }
      }
      metafields(identifiers: [
        { namespace: "skincare", key: "skin_types" }
        { namespace: "skincare", key: "concerns" }
      ]) {
        key
        value
      }
    }
  }
`;

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.product ? `${data.product.title} — Glass Skincare` : "Product — Glass Skincare" },
  { name: "description", content: data?.product?.description ?? "" },
];

export async function loader({ params, context, request }: LoaderFunctionArgs) {
  const { handle } = params;
  if (!handle) throw new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const selectedOptions: VariantOption[] = [];
  url.searchParams.forEach((value, name) => {
    selectedOptions.push({ name, value });
  });

  try {
    const { product } = await context.storefront.query<{ product: Product | null }>(
      PRODUCT_QUERY,
      { variables: { handle } }
    );
    if (product) {
      return json({ product, selectedOptions });
    }
  } catch (error) {
    console.warn("Storefront query failed, checking mock product map:", error);
  }

  const mockProduct = MOCK_PRODUCTS_MAP[handle] ?? MOCK_PRODUCTS_MAP["glass-skin-dew-drops"];
  return json({ product: mockProduct, selectedOptions });
}

function parseMetafield(metafields: (Metafield | null)[], key: string): string[] {
  if (!metafields) return [];
  const mf = metafields.find((m) => m?.key === key);
  if (!mf?.value) return [];
  try {
    const parsed = JSON.parse(mf.value);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [mf.value];
  }
}

export default function ProductDetail() {
  const { product, selectedOptions } = useLoaderData<typeof loader>();
  const { linesAdd, status } = useLocalCart();
  const { openDrawer } = useCartDrawer();
  const [added, setAdded] = useState(false);

  const selectedVariant =
    product.variants.nodes.find((variant) =>
      selectedOptions.every((option) =>
        variant.selectedOptions.some(
          (so) => so.name === option.name && so.value === option.value
        )
      )
    ) ?? product.variants.nodes[0];

  const skinTypes = parseMetafield(product.metafields, "skin_types");
  const concerns = parseMetafield(product.metafields, "concerns");

  const isOutOfStock = !selectedVariant?.availableForSale;
  const isLowStock =
    selectedVariant?.quantityAvailable != null &&
    selectedVariant.quantityAvailable > 0 &&
    selectedVariant.quantityAvailable <= 5;

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    const featuredImage = product.images?.nodes?.[0];
    linesAdd([
      {
        merchandiseId: selectedVariant.id,
        quantity: 1,
        attributes: {
          productTitle: product.title,
          productHandle: product.handle,
          productId: product.id,
          variantTitle: selectedVariant.title,
          title: selectedVariant.title,
          imageUrl: featuredImage?.url,
          imageAltText: featuredImage?.altText ?? product.title,
          price: selectedVariant.price?.amount,
          currencyCode: selectedVariant.price?.currencyCode,
          compareAtPrice: selectedVariant.compareAtPrice?.amount,
        },
      },
    ]);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
    window.setTimeout(() => openDrawer(), 250);
  };

  const isAdding = status === "updating";

  return (
    <main className="w-full flex flex-col bg-brand-bg min-h-screen">
      <div className="mx-auto max-w-7xl px-6 py-12 w-full">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-glass-brown/70 mb-8">
          <Link to="/" className="hover:text-glass-charcoal">Home</Link>
          <span>/</span>
          <Link to="/products" className="hover:text-glass-charcoal">Products</Link>
          <span>/</span>
          <span className="text-glass-charcoal">{product.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left: Product Gallery */}
          <div className="lg:col-span-7">
            <ProductGallery images={product.images.nodes} productTitle={product.title} />
          </div>

          {/* Right: Product Info & Buy Action */}
          <div className="lg:col-span-5 flex flex-col space-y-6 bg-white p-8 border-4 border-brand-text rounded-2xl shadow-play">
            {/* Badges */}
            {(skinTypes.length > 0 || concerns.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {skinTypes.map((st) => (
                  <span key={st} className="bg-brand-yellow text-brand-text text-[10px] uppercase font-bold px-3 py-1 border-2 border-brand-text shadow-play">
                    {st}
                  </span>
                ))}
                {concerns.map((c) => (
                  <span key={c} className="bg-brand-pink text-brand-text text-[10px] uppercase font-bold px-3 py-1 border-2 border-brand-text shadow-play">
                    {c}
                  </span>
                ))}
              </div>
            )}

            {/* Title & Price */}
            <div>
              <h1 className="font-display font-bold text-3xl md:text-4xl text-brand-text mb-2">
                {product.title}
              </h1>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-brand-text bg-brand-yellow inline-block px-4 py-1.5 border-2 border-brand-text rounded-full shadow-play">
                  <Money data={(selectedVariant?.price ?? product.priceRange.minVariantPrice) as any} />
                </span>
                {selectedVariant?.compareAtPrice && (
                  <span className="text-base text-gray-500 line-through">
                    <Money data={selectedVariant.compareAtPrice as any} />
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <p className="font-rounded font-semibold text-base text-brand-text/80 leading-relaxed">
              {product.description}
            </p>

            {/* Variant Selector */}
            {product.options.some((o) => o.values.length > 1) && (
              <VariantSelector
                handle={product.handle}
                options={product.options}
                variants={product.variants.nodes as any}
              >
                {({ option }) => (
                  <div key={option.name} className="flex flex-col gap-2">
                    <p className="font-display font-bold text-xs uppercase text-brand-text">{option.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {option.values.map(({ value, isAvailable, isActive, to }) => (
                        <Link
                          key={value}
                          to={to}
                          preventScrollReset
                          prefetch="intent"
                          className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider border-2 border-brand-text transition-all ${
                            isActive
                              ? "bg-brand-magenta text-white shadow-play"
                              : isAvailable
                              ? "bg-white text-brand-text hover:bg-brand-yellow hover:shadow-play"
                              : "bg-gray-100 text-gray-400 opacity-50 cursor-not-allowed"
                          }`}
                        >
                          {value}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </VariantSelector>
            )}

            {/* Add to Cart */}
            <div className="pt-4">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isOutOfStock || isAdding}
                className="w-full bg-brand-accent text-white font-display font-bold text-sm uppercase tracking-widest py-4 border-2 border-brand-text rounded-xl shadow-play hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isOutOfStock
                  ? "Out of Stock"
                  : added
                  ? "Added to Routine Cart ✓"
                  : isAdding
                  ? "Adding to Cart…"
                  : "Add to Routine Cart 🛍️"}
              </button>
              <Link
                to="/cart"
                className="mt-3 w-full block text-center bg-white text-brand-text font-display font-bold text-sm uppercase tracking-widest py-4 border-2 border-brand-text rounded-xl shadow-play hover:bg-brand-yellow hover:translate-y-1 hover:shadow-none transition-all"
              >
                View Cart
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
