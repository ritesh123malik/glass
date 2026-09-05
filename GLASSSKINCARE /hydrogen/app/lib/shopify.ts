/** Storefront API client helpers and shared product types. */

export interface Money {
  amount: string;
  currencyCode: string;
}

export interface ProductImage {
  url: string;
  altText: string | null;
}

export interface ShopifyProductSummary {
  id: string;
  title: string;
  handle: string;
  description: string;
  featuredImage: ProductImage | null;
  priceRange: { minVariantPrice: Money };
}

type StorefrontClient = {
  query: (
    query: string,
    options: { variables: Record<string, unknown> },
  ) => Promise<{ products: { nodes: ShopifyProductSummary[] } }>;
};

const PRODUCTS_BY_HANDLE_QUERY = `#graphql
  query ProductsByHandle($query: String!) {
    products(first: 50, query: $query) {
      nodes {
        id
        title
        handle
        description
        featuredImage { url altText }
        priceRange { minVariantPrice { amount currencyCode } }
      }
    }
  }
`;

export async function fetchProductsByHandles(
  storefront: StorefrontClient,
  handles: string[],
): Promise<ShopifyProductSummary[]> {
  if (handles.length === 0) return [];

  const query = handles.map((handle) => `handle:${handle}`).join(" OR ");
  const { products } = await storefront.query(PRODUCTS_BY_HANDLE_QUERY, {
    variables: { query },
  });

  return products.nodes;
}
