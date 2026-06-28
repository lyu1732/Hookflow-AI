import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#07070a",
        panel: "#111117",
        panelSoft: "#171722",
        line: "rgba(255,255,255,0.11)",
        mint: "#36f4a4",
        coral: "#ff4365",
        cyan: "#25f4ee"
      },
      boxShadow: {
        glow: "0 0 36px rgba(37, 244, 238, 0.18)",
        lift: "0 20px 80px rgba(0, 0, 0, 0.38)"
      }
    }
  },
  plugins: []
};

export default config;
