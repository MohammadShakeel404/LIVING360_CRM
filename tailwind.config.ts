import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#523AB7", deep: "#432F9C" },
        gold: "#FEB73F",
        dark: "#251A51",
        ink: { DEFAULT: "#1D1730", soft: "#6B6480", faint: "#9791AC" },
        line: { DEFAULT: "#E8E4F2", soft: "#F0EDF7" },
        success: { DEFAULT: "#1F9D66", bg: "#E8F6EF" },
        warning: { DEFAULT: "#E8873D", bg: "#FDF0E4" },
        danger: { DEFAULT: "#D64545", bg: "#FBEAEA" },
        appbg: "#F6F5FB",
      },
      fontFamily: {
        sans: ["Afacad", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "14px",
      },
      keyframes: {
        slideUp: { from: { transform: "translateY(24px)", opacity: "0.6" }, to: { transform: "translateY(0)", opacity: "1" } },
      },
      animation: {
        slideUp: "slideUp 0.22s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
