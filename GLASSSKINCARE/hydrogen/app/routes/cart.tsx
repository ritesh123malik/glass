import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { useLocalCart } from "~/components/cart/LocalCartProvider";

export const meta: MetaFunction = () => [
  { title: "Your Cart — GlassSkin" },
  { name: "description", content: "Review your GlassSkin routine cart." },
];

/** Formats a Storefront MoneyV2 amount into a display string. */
function formatMoney(amount?: string, currencyCode?: string): string {
  if (!amount) return "";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode ?? "USD",
    }).format(parseFloat(amount));
  } catch {
    return `$${amount}`;
  }
}

type CartLine = NonNullable<
  NonNullable<ReturnType<typeof useLocalCart>["lines"]>[number]
>;
const hasLines = (lines: unknown): lines is CartLine[] =>
  Array.isArray(lines) && lines.every(Boolean);

export default function CartPage() {
  const {
    lines,
    totalQuantity,
    cost,
    linesUpdate,
    linesRemove,
    status,
    cartReady,
  } = useLocalCart();

  const updating = status === "updating";
  const cartLoading = !cartReady;
  const cartLines = hasLines(lines) ? lines : [];
  const subtotal = cost?.subtotalAmount;
  const total = cost?.totalAmount;

  const changeQuantity = (lineId: string, quantity: number) => {
    if (quantity < 1) {
      linesRemove([lineId]);
      return;
    }
    linesUpdate([{ id: lineId, quantity }]);
  };

  return (
    <main className="w-full flex flex-col bg-brand-bg min-h-screen">
      {/* Page Header */}
      <div className="w-full bg-brand-yellow border-b-4 border-brand-text py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="inline-block bg-brand-magenta text-white text-xs px-4 py-1.5 -rotate-2 mb-3 font-display font-bold uppercase tracking-widest border-2 border-brand-text shadow-play">
              Your Routine
            </span>
            <h1 className="font-display font-bold text-4xl md:text-6xl text-brand-text">
              Your Cart{" "}
              {totalQuantity != null && totalQuantity > 0 ? (
                <span className="align-middle text-2xl md:text-4xl inline-block bg-white border-2 border-brand-text px-3 py-1 rounded-full shadow-play">
                  {totalQuantity} item{totalQuantity === 1 ? "" : "s"}
                </span>
              ) : null}
            </h1>
          </div>
          <Link
            to="/products"
            className="self-start sm:self-center bg-white text-brand-text font-display font-bold text-xs uppercase tracking-widest px-6 py-3 border-2 border-brand-text rounded-xl shadow-play hover:bg-brand-sky hover:translate-y-0.5 hover:shadow-none transition-all"
          >
            ← Keep Shopping
          </Link>
        </div>
      </div>

      <div className="w-full max-w-6xl mx-auto px-6 py-12 flex-1">
        {cartLoading ? (
          /* Hydrating / loading the cart from the Storefront API */
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="w-14 h-14 border-4 border-brand-text border-t-brand-magenta rounded-full animate-spin" />
            <p className="font-rounded font-semibold text-brand-text/60">
              Loading your routine cart…
            </p>
          </div>
        ) : cartLines.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
            <div className="w-32 h-32 rounded-full bg-brand-pink border-4 border-brand-text shadow-play flex items-center justify-center text-5xl rotate-6">
              🫧
            </div>
            <div>
              <h2 className="font-display font-bold text-3xl md:text-4xl text-brand-text mb-3">
                Your cart is <span className="text-brand-magenta">empty</span>
              </h2>
              <p className="font-rounded font-semibold text-lg text-brand-text/60 max-w-md mx-auto">
                Your glass skin routine is waiting. Discover feel-good formulas that melt in and glow on.
              </p>
            </div>
            <Link
              to="/products"
              className="bg-brand-accent text-white font-display font-bold text-sm uppercase tracking-widest px-10 py-4 border-2 border-brand-text rounded-xl shadow-play hover:translate-y-1 hover:shadow-none transition-all"
            >
              Shop the Glow ✨
            </Link>
          </div>
        ) : (
          /* Two-column layout */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Line items */}
            <div className="lg:col-span-8 space-y-5">
              {cartLines.map((line) => {
                const merchandise = line.merchandise;
                const image = merchandise?.image;
                const lineTotal = line.cost?.totalAmount;
                const compareAt = merchandise?.compareAtPrice;
                const unitPrice = line.cost?.amountPerQuantity;
                return (
                  <div
                    key={line.id}
                    className="flex flex-col sm:flex-row gap-5 bg-white border-4 border-brand-text rounded-2xl shadow-play p-4 sm:p-5"
                  >
                    {/* Image */}
                    <Link
                      to={`/products/${merchandise?.product?.handle ?? ""}`}
                      className="relative w-full sm:w-32 h-40 sm:h-32 shrink-0 overflow-hidden rounded-xl border-2 border-brand-text bg-brand-sky/20 block"
                    >
                      {image?.url ? (
                        <img
                          src={image.url}
                          alt={image.altText ?? merchandise?.product?.title ?? ""}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-brand-text/40 text-[10px] font-bold uppercase tracking-widest text-center px-2">
                          No image
                        </div>
                      )}
                      {compareAt?.amount ? (
                        <span className="absolute top-2 left-2 bg-brand-magenta text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border-2 border-brand-text shadow-play rotate-[-3deg]">
                          Sale
                        </span>
                      ) : null}
                    </Link>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex justify-between gap-3">
                        <div>
                          <Link
                            to={`/products/${merchandise?.product?.handle ?? ""}`}
                            className="font-display font-bold text-lg text-brand-text hover:text-brand-magenta transition leading-tight"
                          >
                            {merchandise?.product?.title ?? "Product"}
                          </Link>
                          {merchandise?.title ? (
                            <p className="text-xs font-rounded font-semibold text-brand-text/60 mt-0.5 uppercase tracking-wide">
                              {merchandise.title}
                            </p>
                          ) : null}
                        </div>
                        <button
                          onClick={() => changeQuantity(line.id as string, 0)}
                          disabled={updating}
                          className="text-brand-text/40 hover:text-brand-magenta transition font-display font-bold text-xs uppercase tracking-wider h-fit disabled:opacity-40"
                          aria-label="Remove item"
                        >
                          ✕ Remove
                        </button>
                      </div>

                      {/* Price row + qty */}
                      <div className="mt-auto pt-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-1 border-2 border-brand-text rounded-xl bg-brand-bg overflow-hidden">
                          <button
                            onClick={() =>
                              changeQuantity(line.id as string, (line.quantity ?? 1) - 1)
                            }
                            disabled={updating}
                            className="w-9 h-9 flex items-center justify-center text-lg font-black hover:bg-brand-yellow transition disabled:opacity-40"
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="w-9 text-center font-display font-bold">
                            {line.quantity}
                          </span>
                          <button
                            onClick={() =>
                              changeQuantity(line.id as string, (line.quantity ?? 0) + 1)
                            }
                            disabled={updating}
                            className="w-9 h-9 flex items-center justify-center text-lg font-black hover:bg-brand-yellow transition disabled:opacity-40"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          {unitPrice ? (
                            <span className="text-sm font-rounded font-bold text-brand-text/50">
                              {formatMoney(unitPrice.amount, unitPrice.currencyCode)} each
                            </span>
                          ) : null}
                          {compareAt?.amount ? (
                            <span className="text-sm text-brand-text/40 line-through font-semibold">
                              {formatMoney(
                                String(Number(compareAt.amount) * (line.quantity ?? 1)),
                                compareAt.currencyCode,
                              )}
                            </span>
                          ) : null}
                          {lineTotal ? (
                            <span className="font-display font-bold text-xl text-brand-text">
                              {formatMoney(lineTotal.amount, lineTotal.currencyCode)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Order summary */}
            <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-5">
              <div className="bg-white border-4 border-brand-text rounded-2xl shadow-play p-6 space-y-4">
                <h2 className="font-display font-bold text-2xl text-brand-text border-b-2 border-brand-text pb-3">
                  Order Summary
                </h2>

                <div className="space-y-2 font-rounded font-semibold text-sm text-brand-text/70">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="text-brand-text font-bold">
                      {subtotal
                        ? formatMoney(subtotal.amount, subtotal.currencyCode)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span className="text-brand-text font-bold">Calculated at checkout</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxes</span>
                    <span className="text-brand-text font-bold">Calculated at checkout</span>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t-2 border-brand-text pt-4">
                  <span className="font-display font-bold text-lg uppercase tracking-wide">Total</span>
                  <span className="font-display font-bold text-3xl text-brand-text">
                    {total
                      ? formatMoney(total.amount, total.currencyCode)
                      : subtotal
                      ? formatMoney(subtotal.amount, subtotal.currencyCode)
                      : "—"}
                  </span>
                </div>

                {/* Free shipping nudges */}
                {subtotal && Number(subtotal.amount) < 50 ? (
                  <p className="text-xs font-rounded font-bold text-brand-text/60 bg-brand-sky/20 border-2 border-brand-text rounded-lg px-3 py-2">
                    Add {formatMoney("50", subtotal.currencyCode)} to unlock free shipping 🚚
                  </p>
                ) : subtotal ? (
                  <p className="text-xs font-rounded font-bold text-brand-text bg-brand-mint/40 border-2 border-brand-text rounded-lg px-3 py-2">
                    🎉 You've unlocked free shipping!
                  </p>
                ) : null}

                <Link
                  to="/checkout"
                  className="w-full block text-center bg-brand-accent text-white font-display font-bold text-sm uppercase tracking-widest py-4 border-2 border-brand-text rounded-xl shadow-play hover:translate-y-1 hover:shadow-none transition-all"
                >
                  Secure Checkout →
                </Link>

                <Link
                  to="/products"
                  className="w-full block text-center bg-white text-brand-text font-display font-bold text-xs uppercase tracking-widest py-3 border-2 border-brand-text rounded-xl shadow-play hover:bg-brand-yellow hover:translate-y-1 hover:shadow-none transition-all"
                >
                  ← Continue Shopping
                </Link>

                <div className="flex items-center justify-center gap-2 pt-1 text-[10px] font-display font-bold uppercase tracking-widest text-brand-text/50">
                  <span aria-hidden>🔒</span> SSL Secure · Shopify Payments
                </div>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap gap-2 justify-center">
                <span className="bg-brand-yellow text-brand-text text-[10px] uppercase font-black px-3 py-1.5 border-2 border-brand-text shadow-play -rotate-1">
                  🌿 Clean Formulas
                </span>
                <span className="bg-brand-mint text-brand-text text-[10px] uppercase font-black px-3 py-1.5 border-2 border-brand-text shadow-play rotate-1">
                  🚚 Free Shipping $50+
                </span>
                <span className="bg-brand-pink text-brand-text text-[10px] uppercase font-black px-3 py-1.5 border-2 border-brand-text shadow-play -rotate-2">
                  💌 30-Day Glow Guarantee
                </span>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
