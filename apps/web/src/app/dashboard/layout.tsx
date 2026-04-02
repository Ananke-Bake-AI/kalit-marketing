"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
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
  Plus,
  Zap,
  BarChart3,
  LogOut,
  Plug,
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

  return (
    <div className="flex min-h-screen">
      {/* Sidebar spacer */}
      <div className="hidden shrink-0 md:block" style={{ width: 240 }} />

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[240px] flex-col border-r border-white/10 bg-[rgba(6,10,20,0.92)] backdrop-blur-xl md:flex">
        {/* Logo */}
        <div className="relative flex items-center gap-3 px-5 py-6">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 120% 80% at 50% -10%, rgba(200,255,0,0.22) 0%, rgba(34,211,238,0.08) 42%, transparent 74%)",
              animation: "haloFade 6s ease-in-out infinite",
            }}
          />
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center border border-white/10 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="absolute inset-1 bg-gradient-to-br from-accent/20 via-transparent to-cyan-400/10" />
            <Megaphone className="relative h-5 w-5 text-accent" />
          </div>
          <div className="relative overflow-hidden whitespace-nowrap">
            <p className="eyebrow mb-1">Growth Console</p>
            <h1 className="text-lg font-bold tracking-[-0.08em] text-white">
              Kalit
            </h1>
            <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">
              Marketing Suite
            </p>
          </div>
        </div>

        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3">
          <div className="mx-2 space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-all duration-200 ${
                    active
                      ? "bg-gradient-to-r from-accent via-lime-300 to-cyan-300 text-slate-950 shadow-[0_12px_30px_rgba(125,211,252,0.18)]"
                      : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 ${active ? "text-slate-950" : "text-slate-500"}`}
                  />
                  <span>{item.label}</span>
                  {active && (
                    <ChevronRight className="ml-auto h-3 w-3 text-slate-950" />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mx-4 my-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <div className="mx-3">
            <Link
              href="/dashboard/workspaces/new"
              className="flex items-center justify-center gap-1.5 border border-dashed border-white/10 py-1.5 text-[10px] uppercase tracking-[0.24em] text-slate-500 transition-all hover:border-accent/20 hover:text-accent"
            >
              <Plus className="h-3 w-3" />
              New Workspace
            </Link>
          </div>
        </nav>

        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Footer */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.24em] text-slate-500">
              Engine Online
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-mono text-[9px] text-slate-700">
              <Zap className="h-2.5 w-2.5" />
              <span>v0.1.0</span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-[0.2em] text-slate-600 transition-colors hover:text-red-400"
            >
              <LogOut className="h-2.5 w-2.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1">
        <div className="mx-auto max-w-[1480px] px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
