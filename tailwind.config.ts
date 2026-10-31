import type { Config } from "tailwindcss";

// Orange Kitchen design tokens, taken from the official logo and banner.
// brand-500 ≈ logo orange; brand-600 is the accessible primary
// (4.6:1 on white); brand-500 is the vivid accent for non-text use.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#FFF5EE",
          100: "#FFE8D6",
          200: "#FFCCA8",
          300: "#FFA970",
          400: "#FF8A3D",
          500: "#F26B1D",
          600: "#CC4A0A",
          700: "#A63B08",
          800: "#7F2E08",
          900: "#5C220A",
        },
        // Warm chocolate brown from the "KITCHEN" wordmark and banner footer
        charcoal: { DEFAULT: "#2C1408", 700: "#3D2014", 500: "#6B5247", 400: "#8C766B" },
        cream: { DEFAULT: "#FFFAEE", 200: "#FCF0D6" },
        leaf: { DEFAULT: "#1E8E3E", 50: "#EAF6EE" },
        chilli: { DEFAULT: "#B42318", 50: "#FDECEA" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      borderRadius: { xl: "0.875rem", "2xl": "1.25rem", "3xl": "1.75rem" },
      boxShadow: {
        card: "0 1px 2px rgba(31,29,27,0.04), 0 8px 24px -12px rgba(31,29,27,0.12)",
        lift: "0 2px 4px rgba(31,29,27,0.04), 0 18px 40px -16px rgba(204,74,10,0.28)",
      },
      keyframes: {
        pulseRing: { "0%": { boxShadow: "0 0 0 0 rgba(242,107,29,0.45)" }, "100%": { boxShadow: "0 0 0 12px rgba(242,107,29,0)" } },
      },
      animation: { pulseRing: "pulseRing 1.6s ease-out infinite" },
    },
  },
  plugins: [],
};
export default config;
