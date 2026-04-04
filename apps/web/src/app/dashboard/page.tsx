export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@kalit/db";
import { auth } from "@/lib/auth";

const lifecycleColors: Record<string, { bg: string; text: string; border: string }> = {
  onboarding:        { bg: "rgba(34,211,238,0.12)", text: "#22d3ee", border: "rgba(34,211,238,0.25)" },
  researching:       { bg: "rgba(100,118,255,0.12)", text: "#6476ff", border: "rgba(100,118,255,0.25)" },
  planning:          { bg: "rgba(129,140,248,0.12)", text: "#818cf8", border: "rgba(129,140,248,0.25)" },
  producing_content: { bg: "rgba(168,85,247,0.12)",  text: "#a855f7", border: "rgba(168,85,247,0.25)" },
  reviewing:         { bg: "rgba(250,204,21,0.12)",  text: "#facc15", border: "rgba(250,204,21,0.25)" },
  executing:         { bg: "rgba(132,204,22,0.12)",  text: "#84cc16", border: "rgba(132,204,22,0.25)" },
  observing:         { bg: "rgba(52,211,153,0.12)",  text: "#34d399", border: "rgba(52,211,153,0.25)" },
  adapting:          { bg: "rgba(251,146,60,0.12)",  text: "#fb923c", border: "rgba(251,146,60,0.25)" },
  learning:          { bg: "rgba(244,114,182,0.12)", text: "#f472b6", border: "rgba(244,114,182,0.25)" },
  scaling:           { bg: "rgba(45,212,191,0.12)",  text: "#2dd4bf", border: "rgba(45,212,191,0.25)" },
  paused:            { bg: "rgba(148,163,184,0.08)", text: "#94a3b8", border: "rgba(148,163,184,0.2)" },
  churned:           { bg: "rgba(248,113,113,0.12)", text: "#f87171", border: "rgba(248,113,113,0.25)" },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const AUTH_DISABLED = process.env.AUTH_DISABLED === "true";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;

  const workspaces = await prisma.workspace.findMany({
    where: AUTH_DISABLED
      ? undefined
      : { members: { some: { userId: userId ?? "no-user" } } },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          campaigns: true,
          tasks: true,
          connectedAccounts: true,
        },
      },
      campaigns: {
        select: { spend: true, revenue: true, status: true },
      },
    },
  });

  const activeWorkspaces = workspaces.filter(
    (w) => !["paused", "churned"].includes(w.status)
  );
  const totalTasks = workspaces.reduce((s, w) => s + w._count.tasks, 0);
  const totalCampaigns = workspaces.reduce(
    (s, w) => s + w.campaigns.filter((c) => c.status === "active").length,
    0
  );
  const totalSpend = workspaces.reduce(
    (s, w) => s + w.campaigns.reduce((cs, c) => cs + c.spend, 0),
    0
  );
  const totalRevenue = workspaces.reduce(
    (s, w) => s + w.campaigns.reduce((cs, c) => cs + c.revenue, 0),
    0
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="eyebrow mb-1">Control Plane</p>
          <h1 className="hero-title text-2xl">Client Workspaces</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Each workspace is an autonomous growth runtime for a client
          </p>
        </div>
        <Link href="/dashboard/workspaces/new" className="btn-primary px-6 py-2.5">
          New Workspace
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Active Workspaces" value={String(activeWorkspaces.length)} />
        <StatCard label="Tasks in Pipeline" value={String(totalTasks)} />
        <StatCard label="Live Campaigns" value={String(totalCampaigns)} />
        <StatCard label="Total Spend" value={formatCurrency(totalSpend)} />
        <StatCard
          label="Total Revenue"
          value={formatCurrency(totalRevenue)}
          highlight={totalRevenue > 0}
        />
      </div>

      {workspaces.length === 0 ? (
        /* Empty state */
        <div className="card-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-accent/10">
            <svg
              className="h-8 w-8 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"
              />
            </svg>
          </div>
          <h3 className="hero-title text-lg">No workspaces yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
            Create a workspace to start managing autonomous growth for a client.
            Each workspace gets its own strategy, campaigns, creatives, and
            learning memory.
          </p>
          <Link
            href="/dashboard/workspaces/new"
            className="btn-primary mt-6 inline-flex px-6 py-2.5"
          >
            Create First Workspace
          </Link>
        </div>
      ) : (
        /* Workspace list */
        <div className="space-y-3">
          {workspaces.map((w) => {
            const colors = lifecycleColors[w.status] || lifecycleColors.paused;
            const spend = w.campaigns.reduce((s, c) => s + c.spend, 0);
            const revenue = w.campaigns.reduce((s, c) => s + c.revenue, 0);
            const roas = spend > 0 ? revenue / spend : null;
            return (
              <Link
                key={w.id}
                href={`/dashboard/workspaces/${w.id}`}
                className="card-gradient-hover flex items-center justify-between p-5 group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-sm font-semibold text-text group-hover:text-accent transition-colors">
                        {w.name}
                      </h3>
                      <span
                        className="badge"
                        style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
                      >
                        {w.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-[12px] text-text-secondary mt-1">
                      {w._count.campaigns} campaigns · {w._count.tasks} tasks · {w._count.connectedAccounts} platforms
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  {spend > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-text-secondary">Spend</p>
                      <p className="text-sm font-semibold text-text">
                        {formatCurrency(spend)}
                      </p>
                    </div>
                  )}
                  {roas !== null && (
                    <div className="text-right">
                      <p className="text-xs text-text-secondary">ROAS</p>
                      <p
                        className={`text-sm font-semibold ${roas >= 2 ? "text-k-green" : roas >= 1 ? "text-emerald-600" : "text-red-500"}`}
                      >
                        {roas.toFixed(2)}x
                      </p>
                    </div>
                  )}
                  <svg
                    className="h-4 w-4 text-text-secondary/30 group-hover:text-accent transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 4.5l7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Lifecycle legend */}
      <div className="mt-8">
        <p className="eyebrow mb-3">Lifecycle States</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(lifecycleColors).map(([status, colors]) => (
            <span
              key={status}
              className="badge"
              style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
            >
              {status.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="card-white p-5">
      <p className="eyebrow mb-3">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? "text-accent" : "text-text"}`}>
        {value}
      </p>
    </div>
  );
}
