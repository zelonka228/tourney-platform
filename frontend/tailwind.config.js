/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Unbounded", "sans-serif"],
        sans: ['"IBM Plex Sans"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      colors: {
        void: "#09090B",
        surface: "#18181B",
        "surface-2": "#27272A",
        cyan: {
          DEFAULT: "#00F0FF",
          glow: "rgba(0,240,255,0.5)",
        },
        volt: "#DFFF00",
        arena: {
          danger: "#FF0055",
          success: "#00FF66",
        },
      },
    },
  },
  plugins: [],
};
