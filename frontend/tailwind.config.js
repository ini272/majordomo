/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      black: "#000000",
      white: "#ffffff",
      gold: "#d4af37",
      parchment: "#c9b896",
      "parchment-light": "#e8dcc8",
      dark: "#1a1a1a",
      "dark-panel": "#0f0f0f",
      red: {
        900: "#8b0000",
        950: "#4a0000",
        300: "#ff6b6b",
        800: "#8b0000",
      },
      green: {
        900: "#1a3d1a",
        800: "#2a5d2a",
        500: "#5fb754",
        400: "#5fb754",
      },
      amber: {
        700: "#8b7355",
      },
    },
    fontFamily: {
      serif: ["Georgia", "serif"],
      body: ["Georgia", "serif"],
    },
    extend: {
      backgroundImage: {
        "parchment-texture":
          "repeating-linear-gradient(0deg, rgba(212, 175, 55, 0.02) 0px, rgba(212, 175, 55, 0.02) 2px, transparent 2px, transparent 4px)",
      },
    },
  },
  plugins: [],
};
