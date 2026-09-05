import { Link } from "@remix-run/react";

export function Footer() {
  return (
    <footer className="w-full bg-brand-bg border-t-4 border-brand-text text-brand-text overflow-hidden">
      {/* Playful Top Marquee Strip */}
      <div className="w-full bg-brand-yellow py-3 border-b-4 border-brand-text overflow-hidden flex items-center">
        <div className="flex animate-marquee whitespace-nowrap">
          <span className="text-xs font-display font-bold uppercase tracking-widest text-brand-text flex items-center">
            <span>✨ GLASS SKIN GUARANTEE</span>
            <span className="mx-6 text-brand-magenta font-black">✦</span>
            <span>100% CRUELTY FREE</span>
            <span className="mx-6 text-brand-magenta font-black">✦</span>
            <span>DERMATOLOGIST APPROVED</span>
            <span className="mx-6 text-brand-magenta font-black">✦</span>
            <span>AI-POWERED FORMULATIONS</span>
            <span className="mx-6 text-brand-magenta font-black">✦</span>
          </span>
          <span className="text-xs font-display font-bold uppercase tracking-widest text-brand-text flex items-center" aria-hidden="true">
            <span>✨ GLASS SKIN GUARANTEE</span>
            <span className="mx-6 text-brand-magenta font-black">✦</span>
            <span>100% CRUELTY FREE</span>
            <span className="mx-6 text-brand-magenta font-black">✦</span>
            <span>DERMATOLOGIST APPROVED</span>
            <span className="mx-6 text-brand-magenta font-black">✦</span>
            <span>AI-POWERED FORMULATIONS</span>
            <span className="mx-6 text-brand-magenta font-black">✦</span>
          </span>
        </div>
      </div>

      {/* Main Footer Grid */}
      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-12 gap-12">
        {/* Brand & Mission Column */}
        <div className="md:col-span-5 flex flex-col items-start space-y-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="font-display font-bold text-3xl md:text-4xl tracking-tight text-brand-text">
              GLASS SKINCARE
            </Link>
            <span className="bg-brand-pink text-brand-text text-[10px] uppercase font-extrabold px-3 py-1 -rotate-3 border-2 border-brand-text shadow-play">
              AI Powered ✨
            </span>
          </div>
          <p className="font-rounded font-semibold text-base text-brand-text/80 max-w-sm leading-relaxed">
            Real science, deliciously simple. Personalized AI routines & bio-compatible formulas crafted to make your skin plump, radiant, and glass-clear.
          </p>
          <div className="pt-2 flex gap-3">
            <span className="bg-brand-mint text-brand-text text-xs px-3 py-1 font-bold border-2 border-brand-text shadow-play rotate-2">
              🧪 Clinical Grade
            </span>
            <span className="bg-brand-sky text-brand-text text-xs px-3 py-1 font-bold border-2 border-brand-text shadow-play -rotate-2">
              🌿 100% Clean
            </span>
          </div>
        </div>

        {/* Quick Links Column */}
        <div className="md:col-span-2">
          <h4 className="font-display font-bold text-base uppercase tracking-wider text-brand-text mb-4 border-b-2 border-brand-text pb-1 inline-block">
            Shop
          </h4>
          <ul className="space-y-3 font-rounded font-semibold text-sm">
            <li>
              <Link to="/products" className="hover:text-brand-magenta hover:translate-x-1 transition-all inline-block">
                All Products
              </Link>
            </li>
            <li>
              <Link to="/skin-quiz" className="hover:text-brand-magenta hover:translate-x-1 transition-all inline-block">
                Skin Quiz
              </Link>
            </li>
            <li>
              <Link to="/products?skin=tag:skin_type:oily" className="hover:text-brand-magenta hover:translate-x-1 transition-all inline-block">
                Oily Skin Rituals
              </Link>
            </li>
            <li>
              <Link to="/products?skin=tag:skin_type:dry" className="hover:text-brand-magenta hover:translate-x-1 transition-all inline-block">
                Dry Skin Moisture
              </Link>
            </li>
          </ul>
        </div>

        {/* Support Column */}
        <div className="md:col-span-2">
          <h4 className="font-display font-bold text-base uppercase tracking-wider text-brand-text mb-4 border-b-2 border-brand-text pb-1 inline-block">
            Support
          </h4>
          <ul className="space-y-3 font-rounded font-semibold text-sm">
            <li>
              <a href="#faq" className="hover:text-brand-magenta hover:translate-x-1 transition-all inline-block">
                FAQ & Help
              </a>
            </li>
            <li>
              <a href="#shipping" className="hover:text-brand-magenta hover:translate-x-1 transition-all inline-block">
                Shipping & Returns
              </a>
            </li>
            <li>
              <a href="#dermatologist" className="hover:text-brand-magenta hover:translate-x-1 transition-all inline-block">
                Ask AI Dermatologist
              </a>
            </li>
            <li>
              <a href="#contact" className="hover:text-brand-magenta hover:translate-x-1 transition-all inline-block">
                Contact Us
              </a>
            </li>
          </ul>
        </div>

        {/* Newsletter Signup Column */}
        <div className="md:col-span-3 flex flex-col justify-start">
          <div className="bg-white border-4 border-brand-text p-6 rounded-2xl shadow-play space-y-4">
            <span className="bg-brand-yellow text-brand-text text-[10px] uppercase font-black px-3 py-1 border-2 border-brand-text shadow-play inline-block -rotate-2">
              Stay In The Glow 💌
            </span>
            <h4 className="font-display font-bold text-xl text-brand-text">
              Join the Dewy Club
            </h4>
            <p className="font-rounded font-semibold text-xs text-brand-text/70">
              Get personalized skincare tips, early access drops, and 15% off your first order.
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-2">
              <input
                type="email"
                placeholder="Enter your email..."
                className="w-full px-4 py-2.5 text-sm font-semibold text-brand-text bg-brand-bg border-2 border-brand-text rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-magenta shadow-play placeholder:text-brand-text/40"
              />
              <button
                type="submit"
                className="w-full mt-1 bg-brand-magenta text-white font-display font-bold text-xs uppercase tracking-widest py-3 border-2 border-brand-text rounded-xl shadow-play hover:translate-y-0.5 hover:shadow-none transition-all"
              >
                Claim 15% Off
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t-4 border-brand-text bg-brand-yellow/30 py-6 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center text-xs font-rounded font-bold text-brand-text gap-4">
          <p>© {new Date().getFullYear()} GLASS SKINCARE. Built with AI & Pure Love. All rights reserved.</p>
          <div className="flex space-x-6">
            <a href="#privacy" className="hover:underline">Privacy Policy</a>
            <a href="#terms" className="hover:underline">Terms of Service</a>
            <a href="#cookies" className="hover:underline">Cookie Preferences</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
