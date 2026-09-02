import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d10",
        panel: "#12161c",
        panel2: "#1a2029",
        border: "#242c36",
        muted: "#8892a6",
        text: "#e6ecf3",
        accent: "#7aa2ff",
        overdue: "#ef4444",
        soon: "#f5b13d",
        later: "#22c55e",
      },
    },
  },
  plugins: [],
};
export default config;
