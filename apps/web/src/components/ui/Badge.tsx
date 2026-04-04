"use client";

import React from "react";

type BadgeVariant = "info" | "success" | "warning" | "error" | "default";

interface BadgeProps {
  variant?: BadgeVariant;
  color?: string;
  children: React.ReactNode;
  className?: string;
}

const variantInlineStyles: Record<BadgeVariant, React.CSSProperties> = {
  info:    { backgroundColor: "rgba(100,118,255,0.12)", color: "#6476ff", borderColor: "rgba(100,118,255,0.25)" },
  success: { backgroundColor: "rgba(52,211,153,0.12)",  color: "#34d399", borderColor: "rgba(52,211,153,0.25)" },
  warning: { backgroundColor: "rgba(251,191,36,0.12)",  color: "#fbbf24", borderColor: "rgba(251,191,36,0.25)" },
  error:   { backgroundColor: "rgba(248,113,113,0.12)", color: "#f87171", borderColor: "rgba(248,113,113,0.25)" },
  default: {},
};

export function Badge({
  variant = "default",
  color,
  children,
  className = "",
}: BadgeProps) {
  const style = color
    ? {
        backgroundColor: `${color}20`,
        color: color,
        borderColor: `${color}40`,
      }
    : variant !== "default"
      ? variantInlineStyles[variant]
      : undefined;

  return (
    <span
      className={`badge ${variant === "default" && !color ? "bg-subtle text-text-secondary" : ""} ${className}`}
      style={style}
    >
      {children}
    </span>
  );
}
