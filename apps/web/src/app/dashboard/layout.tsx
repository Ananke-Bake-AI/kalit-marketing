"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { KalitLogo } from "@/components/ui/KalitLogo";
import { useTheme } from "@/components/ui/ThemeProvider";
import {
  LayoutDashboard,
  Layers,
  Megaphone,
  Palette,
  FolderOpen,
  Wand2,
  Share2,
  FlaskConical,
  Brain,
  Settings,
  ChevronRight,
  ChevronLeft,
  Plus,
  Zap,
  BarChart3,
  LogOut,
  Plug,
  Menu,
  X,
  Sun,
  Moon,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Pipeline", icon: Layers, href: "/dashboard/pipeline" },
  { label: "Campaigns", icon: Megaphone, href: "/dashboard/campaigns" },
  { label: "Reporting", icon: BarChart3, href: "/dashboard/reporting" },
  { label: "Creatives", icon: Palette, href: "/dashboard/creatives" },
  { label: "Brand Assets", icon: FolderOpen, href: "/dashboard/assets" },
  { label: "Studio", icon: Wand2, href: "/dashboard/studio" },
  { label: "Social", icon: Share2, href: "/dashboard/social" },
  { label: "Experiments", icon: FlaskConical, href: "/dashboard/experiments" },
  { label: "Memory", icon: Brain, href: "/dashboard/memory" },
  { label: "Connections", icon: Plug, href: "/dashboard/connections" },
  { label: "Settings", icon: Settings, href: "/dashboard/settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === "dark";

  const navContent = (isExpanded: boolean, isMobile: boolean) => (
    <>
      {/* Logo */}
      <div className={`flex items-center py-5 ${isExpanded ? "gap-2.5 px-5" : "justify-center px-2"}`}>
        <KalitLogo size={isExpanded ? 26 : 22} color={isDark ? "light" : "dark"} />
        {isExpanded && (
          <div className="flex items-baseline gap-1">
            <span className="text-[1.25rem] leading-none font-heading" style={{ color: "var(--text)" }}>
              kalit
            </span>
            <span className="text-[1.25rem] leading-none font-heading" style={{ color: "var(--accent)" }}>
              marketing
            </span>
          </div>
        )}
      </div>

      <div className="mx-4 h-px" style={{ background: "var(--divider)" }} />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        <div className={isExpanded ? "mx-2 space-y-0.5" : "space-y-0.5 px-1.5"}>
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;

            if (!isExpanded) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  title={item.label}
                  className="flex items-center justify-center rounded-lg py-2.5 transition-all duration-200"
                  style={{
                    background: active ? "var(--sidebar-active-bg)" : "transparent",
                    color: active ? "var(--sidebar-active-text)" : "var(--sidebar-text)",
                  }}
                >
                  <Icon className="h-4 w-4" />
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200"
                style={{
                  background: active ? "var(--sidebar-active-bg)" : "transparent",
                  color: active ? "var(--sidebar-active-text)" : "var(--sidebar-text)",
                  boxShadow: active ? "var(--shadow-soft)" : "none",
                }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
                {active && <ChevronRight className="ml-auto h-3 w-3 opacity-60" />}
              </Link>
            );
          })}
        </div>

        <div className="mx-4 my-3 h-px" style={{ background: "var(--divider)" }} />

        <div className={isExpanded ? "mx-3" : "mx-1.5"}>
          <Link
            href="/dashboard/workspaces/new"
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-[11px] font-medium transition-all"
            style={{
              borderColor: "var(--divider)",
              color: "var(--text-secondary)",
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            {isExpanded && "New Workspace"}
          </Link>
        </div>
      </nav>

      <div className="mx-4 h-px" style={{ background: "var(--divider)" }} />

      {/* Footer */}
      <div className={`py-4 ${isExpanded ? "px-5" : "flex flex-col items-center px-0"}`}>
        <div className={`flex items-center gap-2 ${!isExpanded ? "justify-center" : ""}`}>
          <span className="gradient-dot" />
          {isExpanded && (
            <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
              Engine Online
            </span>
          )}
        </div>
        {isExpanded && (
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-mono text-[10px]" style={{ color: "var(--text-secondary)" }}>
              <Zap className="h-2.5 w-2.5" />
              <span>v0.1.0</span>
            </div>
            <div className="flex items-center gap-1">
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: "var(--text-secondary)" }}
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                title={isDark ? "Light mode" : "Dark mode"}
              >
                {isDark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="rounded-lg p-1.5 text-[10px] font-medium transition-colors hover:text-red-500"
                style={{ color: "var(--text-secondary)" }}
                title="Sign out"
              >
                <LogOut className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
        {!isExpanded && (
          <button
            onClick={toggleTheme}
            className="mt-2 rounded-lg p-1.5 transition-colors"
            style={{ color: "var(--text-secondary)" }}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {/* Collapse toggle (desktop only) */}
      {!isMobile && (
        <div className="px-3 pb-3">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center justify-center rounded-lg py-1.5 transition-colors duration-150"
            style={{ color: "var(--text-secondary)" }}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      )}
    </>
  );

  const sidebarWidth = collapsed ? 56 : 250;

  return (
    <div className="flex min-h-screen">
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen((o) => !o)}
        className="fixed left-4 top-5 z-50 rounded-full p-2 backdrop-blur-xl transition-colors md:hidden"
        style={{
          backgroundColor: "var(--sidebar-bg)",
          boxShadow: "var(--shadow-glass)",
          color: "var(--text)",
        }}
        aria-label="Toggle sidebar"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className="fixed left-0 top-0 z-40 flex h-full w-[260px] flex-col transition-transform duration-300 md:hidden"
        style={{
          backgroundColor: "var(--sidebar-bg)",
          backdropFilter: "blur(24px) saturate(1.2)",
          WebkitBackdropFilter: "blur(24px) saturate(1.2)",
          boxShadow: mobileOpen ? "var(--shadow-elevated)" : "none",
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {navContent(true, true)}
      </aside>

      {/* Desktop sidebar spacer */}
      <div className="hidden shrink-0 md:block" style={{ width: sidebarWidth }} />

      {/* Desktop sidebar */}
      <aside
        className="hidden h-screen overflow-hidden transition-[width] duration-300 ease-[var(--ease-smooth)] md:fixed md:left-0 md:top-0 md:z-40 md:flex md:flex-col"
        style={{
          width: sidebarWidth,
          backgroundColor: "var(--sidebar-bg)",
          backdropFilter: "blur(16px) saturate(1.2)",
          WebkitBackdropFilter: "blur(16px) saturate(1.2)",
          borderRight: `1px solid var(--sidebar-border)`,
        }}
      >
        {navContent(!collapsed, false)}
      </aside>

      {/* Main content */}
      <main className="flex-1">
        <div className="mx-auto max-w-[1480px] px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
