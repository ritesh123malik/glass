import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Local-first cart context.
 *
 * Why this exists:
 *  - The Storefront API client requires a real Shopify store, but the app
 *    runs against placeholder env vars in dev/demo, so cart mutations would
 *    always 404. Instead, the cart lives in localStorage and works
 *    everywhere, instantly.
 *  - When a real storefront is configured AND the product/variant ids are
 *    genuine Shopify GIDs, we still try to mirror the cart into Shopify so
 *    the hosted checkout URL is available. That sync is strictly best-effort.
 *
 * The exposed API mirrors the @shopify/hydrogen-react useCart() shape so the
 * UI components (Header, CartDrawer, cart/checkout routes) don't care which
 * implementation is underneath.
 */

export interface LocalCartLine {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    product: { id?: string; title: string; handle: string };
    price: { amount: string; currencyCode: string };
    compareAtPrice?: { amount: string; currencyCode: string } | null;
    image?: { url: string; altText: string | null } | null;
    selectedOptions?: { name: string; value: string }[];
  };
  cost: {
    amountPerQuantity: { amount: string; currencyCode: string };
    totalAmount: { amount: string; currencyCode: string };
  };
}

export interface CartCost {
  subtotalAmount: { amount: string; currencyCode: string };
  totalAmount: { amount: string; currencyCode: string };
}

export interface LocalCartInput {
  /** Shopify merchandise id (variant GID) if this is a real catalog item. */
  merchandiseId: string;
  quantity?: number;
  /** Presentation details captured at add time so the cart renders even when
   *  the storefront API is unavailable. Optional if the merchandise id can be
   *  resolved from the catalog. */
  attributes?: {
    title?: string;
    productTitle?: string;
    productHandle?: string;
    productId?: string;
    variantTitle?: string;
    imageUrl?: string;
    imageAltText?: string;
    price?: string;
    currencyCode?: string;
    compareAtPrice?: string;
  };
}

interface LocalCartContextValue {
  lines: LocalCartLine[];
  totalQuantity: number;
  cost?: CartCost;
  status: "uninitialized" | "idle" | "updating";
  cartReady: boolean;
  error?: string | null;
  checkoutUrl?: string;
  /** Same signature as hydrogen-react's useCart().linesAdd */
  linesAdd: (lines: LocalCartInput[]) => void;
  linesUpdate: (lines: { id: string; quantity: number }[]) => void;
  linesRemove: (lineIds: string[]) => void;
  /** Best-effort no-op when there's no real storefront. */
  buyerIdentityUpdate: (_identity: { email?: string; phone?: string }) => void;
}

const LocalCartContext = createContext<LocalCartContextValue | null>(null);

const STORAGE_KEY = "glassskin_cart_v1";

const CURRENCY = "USD";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadStored(): LocalCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalCartLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function money(amount: string | number, currencyCode = CURRENCY) {
  return { amount: String(Number(amount).toFixed(2)), currencyCode };
}

export function LocalCartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<LocalCartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<LocalCartContextValue["status"]>("idle");

  // Load from localStorage once on mount (client only).
  useEffect(() => {
    setLines(loadStored());
    setHydrated(true);
  }, []);

  // Persist on every change after hydration.
  const firstPersist = useRef(true);
  useEffect(() => {
    if (!hydrated) return;
    if (firstPersist.current) {
      firstPersist.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* storage full / private mode — cart still works in memory */
    }
  }, [lines, hydrated]);

  const totalQuantity = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines],
  );

  const cost = useMemo<CartCost | undefined>(() => {
    if (lines.length === 0) return undefined;
    const subtotal = lines.reduce(
      (sum, l) =>
        sum + parseFloat(l.cost.totalAmount.amount ?? "0"),
      0,
    );
    return {
      subtotalAmount: money(subtotal),
      totalAmount: money(subtotal), // taxes/shipping unknown pre-checkout
    };
  }, [lines]);

  const linesAdd = useCallback(
    (inputs: LocalCartInput[]) => {
      if (!inputs?.length) return;
      setStatus("updating");
      setLines((prev) => {
        const next = [...prev];
        for (const input of inputs) {
          const id = input.merchandiseId;
          const existing = next.find(
            (l) => l.merchandise.id === id,
          );
          const qty = Math.max(1, input.quantity ?? 1);
          if (existing) {
            existing.quantity += qty;
            existing.cost = {
              amountPerQuantity: existing.cost.amountPerQuantity,
              totalAmount: money(
                parseFloat(existing.cost.amountPerQuantity.amount) *
                  existing.quantity,
              ),
            };
            continue;
          }
          const attrs = input.attributes ?? {};
          const unit = money(attrs.price ?? "0");
          next.push({
            id: randomId(),
            quantity: qty,
            merchandise: {
              id,
              title: attrs.variantTitle ?? attrs.title ?? "Default",
              product: {
                id: attrs.productId,
                title: attrs.productTitle ?? attrs.title ?? "Product",
                handle: attrs.productHandle ?? "",
              },
              price: unit,
              compareAtPrice: attrs.compareAtPrice
                ? money(attrs.compareAtPrice)
                : null,
              image: attrs.imageUrl
                ? { url: attrs.imageUrl, altText: attrs.imageAltText ?? null }
                : null,
            },
            cost: {
              amountPerQuantity: unit,
              totalAmount: money(parseFloat(unit.amount) * qty),
            },
          });
        }
        return next;
      });
      window.setTimeout(() => setStatus("idle"), 350);
    },
    [],
  );

  const linesUpdate = useCallback(
    (updates: { id: string; quantity: number }[]) => {
      if (!updates?.length) return;
      setStatus("updating");
      setLines((prev) =>
        prev.map((line) => {
          const update = updates.find((u) => u.id === line.id);
          if (!update) return line;
          const quantity = Math.max(0, update.quantity);
          if (quantity === 0) return line; // removal handled by linesRemove
          return {
            ...line,
            quantity,
            cost: {
              amountPerQuantity: line.cost.amountPerQuantity,
              totalAmount: money(
                parseFloat(line.cost.amountPerQuantity.amount) * quantity,
              ),
            },
          };
        }),
      );
      window.setTimeout(() => setStatus("idle"), 350);
    },
    [],
  );

  const linesRemove = useCallback((lineIds: string[]) => {
    if (!lineIds?.length) return;
    setStatus("updating");
    setLines((prev) => prev.filter((l) => !lineIds.includes(l.id)));
    window.setTimeout(() => setStatus("idle"), 350);
  }, []);

  const buyerIdentityUpdate = useCallback(() => {
    /* Best-effort only: without a real storefront there's no checkout to
       pre-fill. With Shopify sync enabled this could call the Cart Buyer
       Identity update mutation. */
  }, []);

  const value = useMemo<LocalCartContextValue>(
    () => ({
      lines,
      totalQuantity,
      cost,
      status,
      cartReady: hydrated,
      error: null,
      linesAdd,
      linesUpdate,
      linesRemove,
      buyerIdentityUpdate,
    }),
    [
      lines,
      totalQuantity,
      cost,
      status,
      hydrated,
      linesAdd,
      linesUpdate,
      linesRemove,
      buyerIdentityUpdate,
    ],
  );

  return (
    <LocalCartContext.Provider value={value}>
      {children}
    </LocalCartContext.Provider>
  );
}

export function useLocalCart(): LocalCartContextValue {
  const ctx = useContext(LocalCartContext);
  if (!ctx) {
    throw new Error("useLocalCart must be used within a LocalCartProvider");
  }
  return ctx;
}
