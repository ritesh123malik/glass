import { Link } from "@remix-run/react";
import { useLocalCart } from "~/components/cart/LocalCartProvider";
import { useCartDrawer } from "./cart-context";

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

export function CartDrawer() {
  const { isOpen, closeDrawer } = useCartDrawer();
  const { lines, totalQuantity, cost, linesUpdate, linesRemove, status } =
    useLocalCart();

  if (!isOpen) return null;

  const updating = status === "updating";
  const subtotal = cost?.subtotalAmount;

  const changeQuantity = (lineId: string, quantity: number) => {
    if (quantity < 1) {
      linesRemove([lineId]);
      return;
    }
    linesUpdate([{ id: lineId, quantity }]);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Shopping cart">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 transition-opacity"
        onClick={closeDrawer}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-brand-bg text-brand-text shadow-2xl border-l-4 border-brand-text flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b-4 border-brand-text">
            <h2 className="font-display font-bold text-xl md:text-2xl text-brand-text">
              Your Routine Cart{" "}
              <span className="inline-block bg-brand-magenta text-white text-sm px-2 py-0.5 rounded-full align-middle">
                {totalQuantity ?? 0}
              </span>
            </h2>
            <button
              onClick={closeDrawer}
              className="w-9 h-9 flex items-center justify-center text-xl font-black bg-white border-2 border-brand-text rounded-lg shadow-play hover:translate-y-0.5 hover:shadow-none transition-all"
              aria-label="Close cart"
            >
              ✕
            </button>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {!lines || lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-5">
                <span className="text-5xl" aria-hidden>🫧</span>
                <p className="font-rounded font-semibold text-lg text-brand-text/70">
                  Your cart is currently empty.
                </p>
                <Link
                  to="/products"
                  onClick={closeDrawer}
                  className="bg-brand-accent text-white font-display font-bold text-xs uppercase tracking-widest px-6 py-3 border-2 border-brand-text rounded-xl shadow-play hover:translate-y-0.5 hover:shadow-none transition-all"
                >
                  Shop the Glow
                </Link>
              </div>
            ) : (
              lines.map((line) => {
                if (!line) return null;
                const merchandise = line.merchandise;
                const image = merchandise?.image;
                const lineTotal = line.cost?.totalAmount;
                return (
                  <div
                    key={line.id}
                    className="flex gap-4 border-2 border-brand-text bg-white rounded-xl p-3 shadow-play"
                  >
                    {/* Thumbnail */}
                    <div className="w-20 h-20 shrink-0 overflow-hidden rounded-lg border-2 border-brand-text bg-brand-sky/20">
                      {image?.url ? (
                        <img
                          src={image.url}
                          alt={image.altText ?? merchandise?.product?.title ?? ""}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-brand-text/40 text-[10px] font-bold uppercase tracking-widest text-center px-1">
                          No img
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2">
                        <p className="font-display font-bold text-sm text-brand-text leading-tight">
                          {merchandise?.product?.title ?? "Product"}
                        </p>
                        <button
                          onClick={() => changeQuantity(line.id as string, 0)}
                          className="text-brand-text/50 hover:text-brand-magenta transition text-xs font-black uppercase tracking-wider shrink-0"
                          aria-label="Remove item"
                        >
                          Remove
                        </button>
                      </div>
                      {merchandise?.title ? (
                        <p className="text-xs font-rounded font-semibold text-brand-text/60 mt-0.5">
                          {merchandise.title}
                        </p>
                      ) : null}
                      {line.cost?.amountPerQuantity ? (
                        <p className="text-sm font-extrabold text-brand-text mt-1.5">
                          {formatMoney(
                            line.cost.amountPerQuantity.amount,
                            line.cost.amountPerQuantity.currencyCode,
                          )}
                        </p>
                      ) : null}

                      {/* Quantity stepper */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1 border-2 border-brand-text rounded-lg bg-brand-bg overflow-hidden">
                          <button
                            onClick={() => changeQuantity(line.id as string, (line.quantity ?? 1) - 1)}
                            disabled={updating}
                            className="w-7 h-7 flex items-center justify-center text-sm font-black hover:bg-brand-yellow transition disabled:opacity-40"
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="w-7 text-center text-sm font-bold">
                            {line.quantity}
                          </span>
                          <button
                            onClick={() => changeQuantity(line.id as string, (line.quantity ?? 0) + 1)}
                            disabled={updating}
                            className="w-7 h-7 flex items-center justify-center text-sm font-black hover:bg-brand-yellow transition disabled:opacity-40"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                        {lineTotal ? (
                          <span className="text-sm font-display font-bold text-brand-text">
                            {formatMoney(lineTotal.amount, lineTotal.currencyCode)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer / Checkout */}
          {lines && lines.length > 0 ? (
            <div className="px-6 py-5 border-t-4 border-brand-text space-y-3 bg-white">
              <div className="flex justify-between items-center">
                <span className="font-rounded font-bold text-sm text-brand-text/70 uppercase tracking-wider">
                  Subtotal
                </span>
                <span className="font-display font-bold text-2xl text-brand-text">
                  {subtotal
                    ? formatMoney(subtotal.amount, subtotal.currencyCode)
                    : formatMoney(cost?.totalAmount?.amount, cost?.totalAmount?.currencyCode)}
                </span>
              </div>
              <p className="text-xs font-rounded font-semibold text-brand-text/50">
                Shipping & taxes calculated at checkout.
              </p>
              <Link
                to="/checkout"
                onClick={closeDrawer}
                className="w-full block text-center bg-brand-accent text-white font-display font-bold text-sm uppercase tracking-widest py-4 border-2 border-brand-text rounded-xl shadow-play hover:translate-y-1 hover:shadow-none transition-all"
              >
                Checkout →
              </Link>
              <Link
                to="/cart"
                onClick={closeDrawer}
                className="w-full block text-center bg-white text-brand-text font-display font-bold text-sm uppercase tracking-widest py-3 border-2 border-brand-text rounded-xl shadow-play hover:bg-brand-yellow hover:translate-y-1 hover:shadow-none transition-all"
              >
                View Full Cart
              </Link>
              <button
                onClick={closeDrawer}
                className="w-full text-center text-xs font-rounded font-bold uppercase tracking-widest text-brand-text/60 hover:text-brand-text transition pt-1"
              >
                Continue Shopping
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
