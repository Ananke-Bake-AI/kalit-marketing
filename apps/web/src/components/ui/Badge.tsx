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
  info: "bg-blue-100 text-blue-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
  default: "bg-subtle text-text-secondary",
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
