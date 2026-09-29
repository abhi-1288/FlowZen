import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  // `./lib` must stay in this list: `lib/toast-context.tsx` renders the toast
  // layer, and if it goes unscanned its `z-[9999]` / `z-[200]` classes are never
  // emitted, so the toasts silently fall back to `z-index: auto` and get painted
  // underneath every modal.
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./store/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--c-text)",
        surface: {
          DEFAULT: "var(--c-bg-card)",
          secondary: "var(--c-bg)",
          tertiary: "var(--c-bg-hover)",
          hover: "var(--c-bg-hover)",
        },
        border: {
          DEFAULT: "var(--c-border)",
          light: "var(--c-border-light)",
          focus: "var(--color-primary, #2563eb)",
        },
        muted: "var(--c-text-muted)",
      },
      borderRadius: {
        card: "8px",
        btn: "6px",
        input: "6px",
        badge: "9999px",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "0 2px 8px rgba(0,0,0,0.06)",
        dropdown: "var(--shadow-dropdown)",
        modal: "var(--shadow-modal)",
        soft: "0 8px 30px rgba(15, 23, 42, 0.08)",
      },
      fontSize: {
        display: ["1.75rem", { lineHeight: "1.2", fontWeight: "600", letterSpacing: "-0.01em" }],
        title: ["1.125rem", { lineHeight: "1.35", fontWeight: "600" }],
        body: ["0.8125rem", { lineHeight: "1.6" }],
        caption: ["0.75rem", { lineHeight: "1.4" }],
        overline: ["0.6875rem", { lineHeight: "1", fontWeight: "600", letterSpacing: "0.04em" }],
      },
      keyframes: {
        "gradient-x": {
          "0%, 100%": {
            backgroundSize: "200% 200%",
            backgroundPosition: "left center"
          },
          "50%": {
            backgroundSize: "200% 200%",
            backgroundPosition: "right center"
          }
        },
        "aurora-drift": {
          "0%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(80px, 40px) scale(1.1)" },
          "100%": { transform: "translate(-40px, 80px) scale(0.95)" }
        },
        "float": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "25%": { transform: "translate(30px, -20px)" },
          "50%": { transform: "translate(-20px, 30px)" },
          "75%": { transform: "translate(15px, 15px)" }
        },
        "marquee": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" }
        }
      },
      animation: {
        "gradient-x": "gradient-x 5s ease infinite",
        "aurora-drift": "aurora-drift 18s ease-in-out infinite alternate",
        "float": "float 20s ease-in-out infinite",
        "marquee": "marquee 30s linear infinite"
      }
    }
  },
  // `animate-in` / `fade-in` / `slide-in-from-*` (used by toasts and several
  // modals) are no-ops without this plugin. v1 is the Tailwind 3 line.
  plugins: [animate]
};

export default config;
