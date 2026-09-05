import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

/**
 * Glass Skincare design system
 * ---------------------------
 * DEFAULT theme = iOS-style glassmorphism (cream / sand / tan / brown / charcoal)
 * OPT-IN theme  = neobrutalism via `.neobrutalism` ancestor (magenta / yellow / sky / mint / blue / accent)
 *
 * Glass tokens are exposed as `bg-glass-cream`, `text-glass-brown`, etc.
 * Neobrutalism tokens keep the `brand-*` names so the legacy `_index.tsx`,
 * `products._index.tsx` and `ProductCard.tsx` continue to work without rewrites.
 */

export default {
  content: ["./app/**/*.{ts,tsx,js,jsx}"],
  // Design-system glass primitives should always be available — they're
  // referenced from Tailwind config + CSS, not from a scanned file, so
  // without safelisting Tailwind tree-shakes them.
  safelist: [
    "glass-card",
    "glass-card-lg",
    "glass-pill",
    "glass-divider",
    "glass-button",
    "glass-input",
    "glass-surface",
    "glass-surface-strong",
  ],
  theme: {
    extend: {
      colors: {
        // Glass Skincare palette (matches glasskin-storefront.vercel.app)
        "glass-cream": "#FFF6EB",
        "glass-sand": "#F5E6D3",
        "glass-tan": "#FFCD78",
        "glass-peach": "#FF9A3D",
        "glass-accent": "#FF7700",
        "glass-blue": "#00559B",
        "glass-sky": "#009EDE",
        "glass-magenta": "#BE008B",
        "glass-red": "#BC0041",
        "glass-yellow": "#FDB500",
        "glass-citron": "#FDE730",
        "glass-pink": "#F4C0D6",
        "glass-lilac": "#E2B0D1",
        "glass-mint": "#5CCAC8",
        "glass-cyan": "#82D8E7",
        "glass-brown": "#261F1A",
        "glass-charcoal": "#261F1A",
        "glass-white": "#FFFFFF",
        "glass-blur-rgb": "255 255 255",
        glass: {
          blur: "rgba(255, 246, 235, 0.95)",
          "blur-strong": "rgba(255, 246, 235, 0.98)",
          "blur-soft": "rgba(255, 246, 235, 0.80)",
        },
        // Neobrutalism palette (fallback for `.neobrutalism` descendants)
        "brand-bg": "#FDFBF7",
        "brand-text": "#1A1A1A",
        "brand-magenta": "#FF007F",
        "brand-yellow": "#FFD700",
        "brand-sky": "#87CEEB",
        "brand-pink": "#FFC0CB",
        "brand-mint": "#98FF98",
        "brand-blue": "#0000FF",
        "brand-accent": "#FF4500",
      },
      fontFamily: {
        serif: ['"Playfair Display"', "Georgia", "serif"],
        display: ['"Archivo Black"', "system-ui", "sans-serif"],
        sans: ['"Raleway"', "ui-rounded", "sans-serif"],
        rounded: ['"Baloo 2"', "ui-rounded", "sans-serif"],
        body: ['"Raleway"', "ui-rounded", "sans-serif"],
      },
      boxShadow: {
        // iOS glass
        glass: "0 8px 32px 0 rgba(31, 38, 135, 0.12)",
        "glass-lg": "0 12px 48px 0 rgba(31, 38, 135, 0.18)",
        "glass-sm": "0 4px 16px 0 rgba(31, 38, 135, 0.08)",
        // Neobrutalism
        play: "4px 4px 0px 0px rgba(26,26,26,1)",
      },
      backdropBlur: {
        glass: "20px",
        "glass-lg": "32px",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        marquee: "marquee 25s linear infinite",
        "logo-marquee": "marquee 30s linear infinite",
      },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        ".glass-card": {
          "background-color": "rgba(255,255,255,0.72)",
          "backdrop-filter": "blur(20px) saturate(180%)",
          "-webkit-backdrop-filter": "blur(20px) saturate(180%)",
          "border-width": "1px",
          "border-color": "rgba(201, 169, 138, 0.25)",
          "border-radius": "1rem",
          "box-shadow": "0 8px 32px 0 rgba(31, 38, 135, 0.12)",
        },
        ".glass-card-lg": {
          "background-color": "rgba(255,255,255,0.72)",
          "backdrop-filter": "blur(32px) saturate(180%)",
          "-webkit-backdrop-filter": "blur(32px) saturate(180%)",
          "border-width": "1px",
          "border-color": "rgba(201, 169, 138, 0.3)",
          "border-radius": "1.5rem",
          "box-shadow": "0 12px 48px 0 rgba(31, 38, 135, 0.18)",
        },
        ".glass-pill": {
          "background-color": "rgba(255,255,255,0.72)",
          "backdrop-filter": "blur(20px) saturate(180%)",
          "-webkit-backdrop-filter": "blur(20px) saturate(180%)",
          "border-width": "1px",
          "border-color": "rgba(201, 169, 138, 0.3)",
          "border-radius": "9999px",
          "padding-left": "1rem",
          "padding-right": "1rem",
          "padding-top": "0.5rem",
          "padding-bottom": "0.5rem",
          "box-shadow": "0 4px 16px 0 rgba(31, 38, 135, 0.08)",
        },
        ".glass-divider": {
          height: "1px",
          width: "100%",
          "background-image":
            "linear-gradient(to right, transparent, rgba(201, 169, 138, 0.4), transparent)",
        },
        ".glass-input": {
          "background-color": "rgba(255,255,255,0.6)",
          "backdrop-filter": "blur(12px) saturate(180%)",
          "-webkit-backdrop-filter": "blur(12px) saturate(180%)",
          "border-width": "1px",
          "border-color": "rgba(201, 169, 138, 0.3)",
          "border-radius": "0.75rem",
        },
        ".glass-button": {
          "background-color": "rgba(255,255,255,0.72)",
          "backdrop-filter": "blur(20px) saturate(180%)",
          "-webkit-backdrop-filter": "blur(20px) saturate(180%)",
          "border-width": "1px",
          "border-color": "rgba(201, 169, 138, 0.3)",
          "border-radius": "0.75rem",
          "box-shadow": "0 4px 16px 0 rgba(31, 38, 135, 0.08)",
          transition: "all 200ms ease",
        },
        ".glass-button:hover": {
          "background-color": "rgba(255,255,255,0.85)",
          "box-shadow": "0 8px 32px 0 rgba(31, 38, 135, 0.15)",
        },
      });
    }),
  ],
} satisfies Config;