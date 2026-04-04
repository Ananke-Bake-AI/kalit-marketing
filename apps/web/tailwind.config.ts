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
        body: "var(--body)",
        "bg-muted": "var(--bg-muted)",
        text: "var(--text)",
        "text-secondary": "var(--text-secondary)",
        surface: "var(--white)",
        divider: "var(--divider)",
        subtle: "var(--subtle)",
        "subtle-strong": "var(--subtle-strong)",
        danger: "var(--danger)",
        // Kalit 4-color system
        k: {
          green: "#91e500",
          "green-alt": "#daff06",
          cyan: "#12bcff",
          "cyan-alt": "#6cf4fb",
          indigo: "#2f44ff",
          "indigo-alt": "#6577ff",
          purple: "#8200df",
          "purple-alt": "#c10ffc",
        },
        // Marketing suite accent (indigo/purple)
        accent: {
          DEFAULT: "var(--accent)",
          light: "var(--accent-light)",
          lighter: "var(--accent-lighter)",
          dim: "rgba(47, 68, 255, 0.15)",
        },
        // Marketing-specific status colors
        lifecycle: {
          onboarding: "#22d3ee",
          auditing: "#3b82f6",
          strategy: "#a855f7",
          producing: "#f59e0b",
          approval: "#ff8c00",
          launching: "#22d3ee",
          monitoring: "#22c55e",
          optimizing: "#10b981",
          scaling: "#14b8a6",
          anomaly: "#ef4444",
          blocked: "#dc2626",
          paused: "#6b7280",
        },
        // Job family colors
        family: {
          research: "#3b82f6",
          production: "#a855f7",
          execution: "#22c55e",
          review: "#f59e0b",
        },
        // Phase colors (from pentest)
        phase: {
          discovery: "#12bcff",
          recon: "#2f44ff",
          enumeration: "#8200df",
          analysis: "#c10ffc",
          exploitation: "#ef4444",
          reporting: "#91e500",
        },
        severity: {
          critical: "#ef4444",
          high: "#f97316",
          medium: "#eab308",
          low: "#3b82f6",
          info: "#7f7f7f",
        },
        status: {
          success: "#91e500",
          warning: "#f59e0b",
          error: "#ef4444",
        },
      },
      fontFamily: {
        heading: ["Cal Sans", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        "2xl": "0.625rem",
        "3xl": "0.75rem",
        "4xl": "1rem",
        "5xl": "1.25rem",
      },
      boxShadow: {
        glass: "var(--shadow-glass)",
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
        elevated: "var(--shadow-elevated)",
      },
      animation: {
        "fade-in": "fadeIn 200ms ease both",
        "zoom-in": "zoomIn95 200ms ease both",
        "slide-up": "slideUp 300ms cubic-bezier(0.3, 0.045, 0.35, 1) both",
        "pulse-soft": "pulseSoft 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
