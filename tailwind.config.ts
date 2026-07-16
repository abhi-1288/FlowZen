import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
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
        }
      },
      animation: {
        "gradient-x": "gradient-x 5s ease infinite"
      }
    }
  },
  plugins: []
};

export default config;
