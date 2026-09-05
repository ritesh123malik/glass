import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { useLocalCart } from "~/components/cart/LocalCartProvider";
import { useState } from "react";

export const meta: MetaFunction = () => [
  { title: "Checkout — GlassSkin" },
  { name: "description", content: "Complete your GlassSkin checkout." },
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

const inputClasses =
  "w-full px-4 py-3 text-sm font-semibold text-brand-text bg-white border-2 border-brand-text rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-magenta placeholder:text-brand-text/40 transition shadow-play";

export default function CheckoutPage() {
  const { lines, cost, cartReady, linesRemove, checkoutUrl } = useLocalCart();
  const [placed, setPlaced] = useState(false);

  const [contact, setContact] = useState({ email: "", phone: "" });
  const [shipping, setShipping] = useState({
    firstName: "",
    lastName: "",
    address1: "",
    address2: "",
    city: "",
    province: "",
    zip: "",
    country: "United States",
  });
  const [submitting, setSubmitting] = useState(false);

  const cartLines = hasLines(lines) ? lines : [];
  const subtotal = cost?.subtotalAmount;
  const total = cost?.totalAmount;
  const cartLoading = !cartReady;

  const updateContact = (field: "email" | "phone", value: string) =>
    setContact((prev) => ({ ...prev, [field]: value }));
  const updateShipping = (field: keyof typeof shipping, value: string) =>
    setShipping((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // With a live Shopify storefront the cart carries a hosted checkout URL
    // and we hand off there. Without one (placeholder env / demo) we simulate
    // placing the order locally: show a confirmation and clear the cart.
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
      return;
    }

    window.setTimeout(() => {
      setPlaced(true);
      setSubmitting(false);
      // Clear the local cart — an order has been placed.
      linesRemove(lines.map((l) => l.id));
    }, 900);
  };

  if (placed) {
    return (
      <main className="w-full flex flex-col bg-brand-bg min-h-screen">
        <div className="flex flex-col items-center justify-center py-32 text-center px-6 space-y-6 flex-1">
          <div className="w-28 h-28 rounded-full bg-brand-mint border-4 border-brand-text shadow-play flex items-center justify-center text-5xl rotate-6">
            🎉
          </div>
          <h1 className="font-display font-bold text-4xl md:text-5xl text-brand-text">
            Order <span className="text-brand-magenta">confirmed!</span>
          </h1>
          <p className="font-rounded font-semibold text-lg text-brand-text/60 max-w-md">
            Thank you — your glow-up is on its way. A confirmation has been sent
            to {contact.email || "your inbox"}.
          </p>
          <div className="flex flex-wrap gap-4 justify-center pt-2">
            <Link
              to="/products"
              className="bg-brand-accent text-white font-display font-bold text-sm uppercase tracking-widest px-8 py-4 border-2 border-brand-text rounded-xl shadow-play hover:translate-y-1 hover:shadow-none transition-all"
            >
              Keep Shopping ✨
            </Link>
            <Link
              to="/"
              className="bg-white text-brand-text font-display font-bold text-sm uppercase tracking-widest px-8 py-4 border-2 border-brand-text rounded-xl shadow-play hover:bg-brand-yellow hover:translate-y-1 hover:shadow-none transition-all"
            >
              Back Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (cartLoading) {
    return (
      <main className="w-full flex flex-col bg-brand-bg min-h-screen">
        <div className="flex flex-col items-center justify-center py-40 text-center px-6 space-y-4 flex-1">
          <div className="w-14 h-14 border-4 border-brand-text border-t-brand-magenta rounded-full animate-spin" />
          <p className="font-rounded font-semibold text-brand-text/60">
            Loading your order…
          </p>
        </div>
      </main>
    );
  }

  if (cartLines.length === 0) {
    return (
      <main className="w-full flex flex-col bg-brand-bg min-h-screen">
        <div className="flex flex-col items-center justify-center py-32 text-center px-6 space-y-6 flex-1">
          <span className="text-6xl" aria-hidden>🧾</span>
          <h1 className="font-display font-bold text-4xl text-brand-text">
            Nothing to check out yet
          </h1>
          <p className="font-rounded font-semibold text-brand-text/60 max-w-md">
            Your cart is empty. Add a few glow-makers before heading to checkout.
          </p>
          <Link
            to="/products"
            className="bg-brand-accent text-white font-display font-bold text-sm uppercase tracking-widest px-10 py-4 border-2 border-brand-text rounded-xl shadow-play hover:translate-y-1 hover:shadow-none transition-all"
          >
            Shop the Glow ✨
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full flex flex-col bg-brand-bg min-h-screen">
      {/* Marquee strip */}
      <div className="w-full bg-brand-magenta py-3 border-b-4 border-brand-text overflow-hidden flex items-center select-none">
        <div className="flex animate-marquee whitespace-nowrap">
          {[0, 1].map((dup) => (
            <span
              key={dup}
              aria-hidden={dup === 1}
              className="text-xs font-display font-bold uppercase tracking-widest text-white flex items-center"
            >
              <span className="mx-4">🔒 Secure Checkout</span>
              <span className="text-brand-yellow">✦</span>
              <span className="mx-4">🚚 Free Shipping Over $50</span>
              <span className="text-brand-yellow">✦</span>
              <span className="mx-4">💌 30-Day Glow Guarantee</span>
              <span className="text-brand-yellow">✦</span>
              <span className="mx-4">✨ Dermatologist Approved</span>
              <span className="text-brand-yellow">✦</span>
            </span>
          ))}
        </div>
      </div>

      <div className="w-full max-w-6xl mx-auto px-6 py-12 flex-1">
        {/* Heading */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
          <div>
            <span className="inline-block bg-brand-sky text-brand-text text-xs px-4 py-1.5 rotate-2 mb-3 font-display font-bold uppercase tracking-widest border-2 border-brand-text shadow-play">
              Almost There
            </span>
            <h1 className="font-display font-bold text-4xl md:text-5xl text-brand-text">
              Secure <span className="text-brand-magenta">Checkout</span>
            </h1>
          </div>
          <Link
            to="/cart"
            className="bg-white text-brand-text font-display font-bold text-xs uppercase tracking-widest px-5 py-3 border-2 border-brand-text rounded-xl shadow-play hover:bg-brand-yellow hover:translate-y-0.5 hover:shadow-none transition-all"
          >
            ← Back to Cart
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Checkout form */}
          <div className="lg:col-span-7 space-y-6">
            {/* Contact */}
            <section className="bg-white border-4 border-brand-text rounded-2xl shadow-play p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 flex items-center justify-center bg-brand-magenta text-white font-display font-bold rounded-full border-2 border-brand-text shadow-play text-sm">
                  1
                </span>
                <h2 className="font-display font-bold text-2xl text-brand-text">Contact</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="email" className="block text-xs font-display font-bold uppercase tracking-widest text-brand-text/60 mb-1.5">
                    Email *
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={contact.email}
                    onChange={(e) => updateContact("email", e.target.value)}
                    placeholder="you@glowmail.com"
                    className={inputClasses}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="phone" className="block text-xs font-display font-bold uppercase tracking-widest text-brand-text/60 mb-1.5">
                    Phone (for delivery updates)
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={contact.phone}
                    onChange={(e) => updateContact("phone", e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className={inputClasses}
                  />
                </div>
              </div>
            </section>

            {/* Shipping address */}
            <section className="bg-white border-4 border-brand-text rounded-2xl shadow-play p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 flex items-center justify-center bg-brand-magenta text-white font-display font-bold rounded-full border-2 border-brand-text shadow-play text-sm">
                  2
                </span>
                <h2 className="font-display font-bold text-2xl text-brand-text">Shipping Address</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-xs font-display font-bold uppercase tracking-widest text-brand-text/60 mb-1.5">
                    First name *
                  </label>
                  <input
                    id="firstName"
                    required
                    value={shipping.firstName}
                    onChange={(e) => updateShipping("firstName", e.target.value)}
                    placeholder="Dewy"
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-xs font-display font-bold uppercase tracking-widest text-brand-text/60 mb-1.5">
                    Last name *
                  </label>
                  <input
                    id="lastName"
                    required
                    value={shipping.lastName}
                    onChange={(e) => updateShipping("lastName", e.target.value)}
                    placeholder="Drops"
                    className={inputClasses}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="address1" className="block text-xs font-display font-bold uppercase tracking-widest text-brand-text/60 mb-1.5">
                    Address *
                  </label>
                  <input
                    id="address1"
                    required
                    value={shipping.address1}
                    onChange={(e) => updateShipping("address1", e.target.value)}
                    placeholder="123 Glow Lane"
                    className={inputClasses}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="address2" className="block text-xs font-display font-bold uppercase tracking-widest text-brand-text/60 mb-1.5">
                    Apartment, suite, etc. (optional)
                  </label>
                  <input
                    id="address2"
                    value={shipping.address2}
                    onChange={(e) => updateShipping("address2", e.target.value)}
                    placeholder="Apt 4B"
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label htmlFor="city" className="block text-xs font-display font-bold uppercase tracking-widest text-brand-text/60 mb-1.5">
                    City *
                  </label>
                  <input
                    id="city"
                    required
                    value={shipping.city}
                    onChange={(e) => updateShipping("city", e.target.value)}
                    placeholder="Glassboro"
                    className={inputClasses}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="province" className="block text-xs font-display font-bold uppercase tracking-widest text-brand-text/60 mb-1.5">
                      State *
                    </label>
                    <input
                      id="province"
                      required
                      value={shipping.province}
                      onChange={(e) => updateShipping("province", e.target.value)}
                      placeholder="NJ"
                      className={inputClasses}
                    />
                  </div>
                  <div>
                    <label htmlFor="zip" className="block text-xs font-display font-bold uppercase tracking-widest text-brand-text/60 mb-1.5">
                      ZIP *
                    </label>
                    <input
                      id="zip"
                      required
                      value={shipping.zip}
                      onChange={(e) => updateShipping("zip", e.target.value)}
                      placeholder="08028"
                      className={inputClasses}
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="country" className="block text-xs font-display font-bold uppercase tracking-widest text-brand-text/60 mb-1.5">
                    Country *
                  </label>
                  <select
                    id="country"
                    value={shipping.country}
                    onChange={(e) => updateShipping("country", e.target.value)}
                    className={inputClasses}
                  >
                    <option>United States</option>
                    <option>Canada</option>
                    <option>United Kingdom</option>
                    <option>Australia</option>
                    <option>Germany</option>
                    <option>France</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Payment note */}
            <section className="bg-brand-mint/30 border-4 border-brand-text rounded-2xl p-6 flex items-start gap-4">
              <span className="text-3xl" aria-hidden>💳</span>
              <div>
                <h3 className="font-display font-bold text-lg text-brand-text mb-1">
                  Payment is handled securely by Shopify
                </h3>
                <p className="font-rounded font-semibold text-sm text-brand-text/70 leading-relaxed">
                  After you place your order you'll be redirected to Shopify's
                  encrypted checkout to pay with a card, Shop Pay, PayPal, and
                  more. We never see your payment details.
                </p>
              </div>
            </section>
          </div>

          {/* Order summary */}
          <aside className="lg:col-span-5 lg:sticky lg:top-24 space-y-5">
            <div className="bg-white border-4 border-brand-text rounded-2xl shadow-play p-6 space-y-4">
              <h2 className="font-display font-bold text-2xl text-brand-text border-b-2 border-brand-text pb-3">
                Your Order
              </h2>

              {/* Mini line items */}
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {cartLines.map((line) => {
                  const merchandise = line.merchandise;
                  const image = merchandise?.image;
                  const lineTotal = line.cost?.totalAmount;
                  return (
                    <div key={line.id} className="flex gap-3 items-center">
                      <div className="relative w-14 h-14 shrink-0 overflow-hidden rounded-lg border-2 border-brand-text bg-brand-sky/20">
                        {image?.url ? (
                          <img
                            src={image.url}
                            alt={image.altText ?? merchandise?.product?.title ?? ""}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[9px] font-bold text-brand-text/40 text-center px-0.5">
                            No img
                          </div>
                        )}
                        <span className="absolute -top-2 -right-2 bg-brand-magenta text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-brand-text">
                          {line.quantity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-bold text-xs text-brand-text leading-tight truncate">
                          {merchandise?.product?.title ?? "Product"}
                        </p>
                        {merchandise?.title ? (
                          <p className="text-[10px] font-rounded font-semibold text-brand-text/50 truncate uppercase">
                            {merchandise.title}
                          </p>
                        ) : null}
                      </div>
                      {lineTotal ? (
                        <span className="font-display font-bold text-sm text-brand-text shrink-0">
                          {formatMoney(lineTotal.amount, lineTotal.currencyCode)}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="border-t-2 border-brand-text pt-4 space-y-2 font-rounded font-semibold text-sm text-brand-text/70">
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
                  <span>Calculated next</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes</span>
                  <span>Calculated next</span>
                </div>
              </div>
              <div className="flex justify-between items-center border-t-2 border-brand-text pt-4">
                <span className="font-display font-bold text-lg uppercase tracking-wide">Total due</span>
                <span className="font-display font-bold text-3xl text-brand-text">
                  {total
                    ? formatMoney(total.amount, total.currencyCode)
                    : subtotal
                    ? formatMoney(subtotal.amount, subtotal.currencyCode)
                    : "—"}
                </span>
              </div>

              {/* Place order */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-brand-accent text-white font-display font-bold text-sm uppercase tracking-widest py-4 border-2 border-brand-text rounded-xl shadow-play hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-60"
                >
                  {submitting
                    ? checkoutUrl
                      ? "Redirecting to secure checkout…"
                      : "Placing your order…"
                    : "Place Order 🔒"}
                </button>
              </form>

              <p className="text-center text-[10px] font-rounded font-bold uppercase tracking-widest text-brand-text/40">
                By continuing you agree to our Terms & Privacy Policy
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
