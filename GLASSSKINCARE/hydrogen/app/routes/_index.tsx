import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { ProductCard } from "~/components/consumer/ProductCard";

interface Product {
  id: string;
  title: string;
  handle: string;
  description: string;
  featuredImage: { url: string; altText: string | null } | null;
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
  };
}

export const meta: MetaFunction = () => [
  { title: "GlassSkin | Super Delicious Skincare" },
  { name: "description", content: "A playful, feel-good skincare storefront." },
];

const MOCK_PRODUCTS: Product[] = [
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

export async function loader({ context }: LoaderFunctionArgs) {
  try {
    const { products } = await context.storefront.query<{
      products: { nodes: Product[] };
    }>(PRODUCTS_QUERY, { variables: { first: 4 } });

    if (products?.nodes && products.nodes.length > 0) {
      return { products: products.nodes };
    }
  } catch (error) {
    console.warn("Storefront API unavailable, falling back to mock products:", error);
  }

  return { products: MOCK_PRODUCTS };
}

const PRODUCTS_QUERY = `#graphql
  query FeaturedProducts($first: Int!) {
    products(first: $first) {
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

export default function Index() {
  const { products } = useLoaderData<typeof loader>();

  return (
    <main className="w-full flex flex-col bg-brand-bg">
      {/* Hero Section */}
      <section className="relative w-full flex flex-col pt-10 pb-20 overflow-hidden">
        <div className="absolute -top-10 -left-10 w-56 h-56 bg-brand-yellow/50 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-brand-sky/40 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-1/3 left-1/2 w-40 h-40 bg-brand-pink/60 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="w-full flex flex-col lg:flex-row min-h-[60vh] items-stretch relative px-6 md:px-12 z-10">
          <div className="w-full lg:w-[55%] flex flex-col justify-center items-start py-16 pr-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="bg-brand-yellow text-brand-text text-xs px-4 py-1.5 -rotate-3 font-bold border-2 border-brand-text shadow-play">100% Cruelty-Free</span>
              <span className="bg-brand-mint text-brand-text text-xs px-4 py-1.5 rotate-2 font-bold border-2 border-brand-text shadow-play">Dermatologist-Tested</span>
            </div>
            <h1 className="font-display font-bold text-5xl md:text-7xl mb-6 leading-tight">
              Grab life<br/>by the <span className="text-brand-accent">glow</span>
            </h1>
            <p className="font-rounded font-semibold text-lg max-w-md mb-8">
              Real science, deliciously simple. Our clean, feel-good formulas melt into skin to refine, plump & illuminate.
            </p>
            <div className="flex gap-4">
              <Link to="/products" className="bg-brand-accent text-white font-bold uppercase tracking-widest text-xs px-8 py-4 border-2 border-brand-text shadow-play hover:translate-y-1 hover:shadow-none transition-all">Shop the Glow</Link>
              <Link to="/quiz" className="bg-white text-brand-text font-bold uppercase tracking-widest text-xs px-8 py-4 border-2 border-brand-text shadow-play hover:bg-brand-yellow hover:translate-y-1 hover:shadow-none transition-all">Find My Ritual</Link>
            </div>
          </div>
          <div className="w-full lg:w-[45%] relative min-h-[400px] border-4 border-brand-text bg-white shadow-play rounded-xl overflow-hidden mt-8 lg:mt-0">
             <img
               src="https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=1000&q=80"
               alt="Glass Skincare Hero"
               className="w-full h-full object-cover"
             />
             <div className="absolute top-6 right-6 w-28 h-28 bg-brand-yellow text-brand-text text-xs rotate-12 shadow-play border-2 border-brand-text rounded-full flex items-center justify-center text-center font-bold">
               Certified<br/>Tasty<br/>✨
             </div>
          </div>
        </div>
      </section>

      {/* Marquee Ticker */}
      <div className="w-full bg-brand-yellow py-4 border-y-4 border-brand-text overflow-hidden flex items-center select-none">
        <div className="flex animate-marquee whitespace-nowrap">
          <span className="text-sm font-display font-bold uppercase tracking-widest text-brand-text flex items-center">
            <span>✨ DERMATOLOGIST TESTED</span>
            <span className="mx-6 text-brand-magenta font-black text-base">✦</span>
            <span>100% CLEAN FORMULAS</span>
            <span className="mx-6 text-brand-magenta font-black text-base">✦</span>
            <span>CRUELTY FREE & VEGAN</span>
            <span className="mx-6 text-brand-magenta font-black text-base">✦</span>
            <span>MADE IN SMALL BATCHES</span>
            <span className="mx-6 text-brand-magenta font-black text-base">✦</span>
            <span>AI-POWERED RITUALS</span>
            <span className="mx-6 text-brand-magenta font-black text-base">✦</span>
          </span>
          <span className="text-sm font-display font-bold uppercase tracking-widest text-brand-text flex items-center" aria-hidden="true">
            <span>✨ DERMATOLOGIST TESTED</span>
            <span className="mx-6 text-brand-magenta font-black text-base">✦</span>
            <span>100% CLEAN FORMULAS</span>
            <span className="mx-6 text-brand-magenta font-black text-base">✦</span>
            <span>CRUELTY FREE & VEGAN</span>
            <span className="mx-6 text-brand-magenta font-black text-base">✦</span>
            <span>MADE IN SMALL BATCHES</span>
            <span className="mx-6 text-brand-magenta font-black text-base">✦</span>
            <span>AI-POWERED RITUALS</span>
            <span className="mx-6 text-brand-magenta font-black text-base">✦</span>
          </span>
        </div>
      </div>

      {/* Featured Products */}
      <section className="py-24 px-6 md:px-12 border-b-4 border-brand-text">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <span className="bg-brand-pink text-brand-text font-bold text-xs px-4 py-1.5 -rotate-2 mb-4 inline-block border-2 border-brand-text shadow-play">Signature Rituals</span>
            <h2 className="font-display font-bold text-4xl md:text-5xl">Shop your <span className="text-brand-magenta">daily</span> rotation</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="mt-16 flex justify-center">
            <Link to="/products" className="bg-brand-blue text-white font-bold uppercase tracking-widest text-xs px-10 py-4 border-2 border-brand-text shadow-play hover:translate-y-1 hover:shadow-none transition-all">
              Shop All Formulations
            </Link>
          </div>
        </div>
      </section>

      {/* Brand Story */}
      <section className="py-24 px-6 md:px-12 bg-brand-pink/40">
        <div className="max-w-4xl mx-auto text-center">
           <span className="bg-brand-mint text-brand-text font-bold text-xs px-4 py-1.5 rotate-2 mb-6 inline-block border-2 border-brand-text shadow-play">Our Origin</span>
           <h2 className="font-display font-bold text-4xl md:text-6xl mb-6">A recipe for <span className="text-brand-magenta">sweeter</span> skin</h2>
           <p className="font-rounded font-semibold text-lg leading-relaxed mb-8">
             We strip away synthetic fillers and focus on active bio-compatible botanicals and essential lipids that harmonize with your skin’s barrier.
           </p>
        </div>
      </section>
    </main>
  );
}
