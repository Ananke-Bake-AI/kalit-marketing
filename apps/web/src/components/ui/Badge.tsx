"use client";

import React from "react";

type BadgeVariant = "info" | "success" | "warning" | "error" | "default";

interface BadgeProps {
  variant?: BadgeVariant;
  color?: string;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  info: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  error: "bg-red-500/15 text-red-400 border-red-500/30",
  default: "bg-white/5 text-gray-400 border-white/10",
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
    : undefined;

  return (
    <span
      className={`badge ${!color ? variantStyles[variant] : ""} ${className}`}
      style={style}
    >
      {children}
    </span>
  );
}
