import { Link } from "@remix-run/react";
import { useLocalCart } from "~/components/cart/LocalCartProvider";
import { useCartDrawer } from "./cart-context";

export function Header() {
  const { openDrawer } = useCartDrawer();
  const { totalQuantity } = useLocalCart();

  return (
    <header className="sticky top-0 z-40 bg-brand-bg/95 backdrop-blur border-b-4 border-brand-text">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          to="/"
          className="font-display font-bold text-lg md:text-2xl tracking-tight text-brand-text hover:text-brand-magenta transition-colors"
        >
          GLASS<span className="text-brand-magenta">SKIN</span>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex space-x-6 lg:space-x-8 text-xs font-display font-bold uppercase tracking-widest">
          <Link to="/" className="hover:text-brand-magenta transition">
            Home
          </Link>
          <Link to="/products" className="hover:text-brand-magenta transition">
            Products
          </Link>
          <Link to="/skin-quiz" className="hover:text-brand-magenta transition">
            Skin Quiz
          </Link>
        </nav>

        {/* Cart button — opens the slide-out drawer */}
        <button
          onClick={openDrawer}
          className="relative flex items-center gap-2 px-4 py-2 text-xs font-display font-bold uppercase tracking-widest bg-white text-brand-text border-2 border-brand-text rounded-xl shadow-play hover:translate-y-0.5 hover:shadow-none transition-all"
          aria-label="Open Cart"
        >
          <span aria-hidden>🛒</span>
          <span className="hidden sm:inline">Cart</span>
          {totalQuantity > 0 ? (
            <span className="px-1.5 py-0.5 text-[10px] leading-none bg-brand-magenta text-white rounded-full">
              {totalQuantity}
            </span>
          ) : null}
        </button>
      </div>
    </header>
  );
}
