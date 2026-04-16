import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f7f6f0",
        surface: "#ffffff",
        ink: "#1d1c1a",
        muted: "#6b6a65",
        rule: "#e7e4d7",
        accent: "#c96442",
        eu: {
          blue: "#003399",
          gold: "#ffcc00",
        },
      },
      fontFamily: {
        sans: ["'Inter'", "system-ui", "sans-serif"],
        serif: ["'Source Serif 4'", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(20,20,20,0.04), 0 4px 12px rgba(20,20,20,0.04)",
      },
    },
  },
  plugins: [],
} satisfies Config;
