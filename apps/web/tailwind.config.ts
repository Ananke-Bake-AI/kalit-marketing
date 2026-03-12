import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#141414",
          light: "#1e1e1e",
          dark: "#0a0a0a",
          darker: "#050505",
        },
        accent: {
          DEFAULT: "#c8ff00",
          light: "#d4ff33",
          dark: "#a8d600",
          dim: "#c8ff0020",
        },
        card: {
          DEFAULT: "#111111",
          border: "#1e1e1e",
          hover: "#191919",
        },
        // Marketing-specific status colors
        lifecycle: {
          onboarding: "#22d3ee",    // cyan
          auditing: "#3b82f6",      // blue
          strategy: "#a855f7",      // purple
          producing: "#f59e0b",     // amber
          approval: "#ff8c00",      // orange
          launching: "#22d3ee",     // cyan
          monitoring: "#22c55e",    // green
          optimizing: "#10b981",    // emerald
          scaling: "#14b8a6",       // teal
          anomaly: "#ef4444",       // red
          blocked: "#dc2626",       // dark red
          paused: "#6b7280",        // gray
        },
        // Job family colors
        family: {
          research: "#3b82f6",      // blue
          production: "#a855f7",    // purple
          execution: "#22c55e",     // green
          review: "#f59e0b",        // amber
        },
      },
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
