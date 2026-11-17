import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#171717",
        ivory: "#F5F1E9",
        beige: "#C6B69B",
        champagne: "#A58B62",
        mist: "#E7E1D6",
        stone: "#8A847A",
        line: "#DDD6C8",
        office: {
          success: "#145C38",
          "success-soft": "#E7F3EC",
          "success-line": "#B7D4C4",
          warning: "#6B450C",
          "warning-soft": "#F8F1E2",
          "warning-line": "#E4D2A8",
          danger: "#7A2E28",
          "danger-soft": "#F8ECEA",
          "danger-line": "#E4C5C0",
          info: "#1E3F5C",
          "info-soft": "#E7EEF4",
          "info-line": "#C5D4E2",
          neutral: "#3F3B36",
          "neutral-soft": "#F3EFE8",
          "neutral-line": "#DDD6C8",
          accent: "#6E5832",
          "accent-soft": "#F3EDE2",
          "accent-line": "#D9C7A4",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "var(--font-arabic)", "sans-serif"],
        display: ["var(--font-display)", "var(--font-arabic)", "serif"],
        arabic: ["var(--font-arabic)", "sans-serif"],
      },
      boxShadow: {
        soft: "0 18px 50px -28px rgba(23,23,23,0.35)",
      },
      maxWidth: {
        store: "1180px",
      },
    },
  },
  plugins: [],
};

export default config;
