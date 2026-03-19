export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@kalit/db";
import { auth } from "@/lib/auth";

const lifecycleColors: Record<string, { bg: string; text: string; border: string }> = {
  onboarding:        { bg: "bg-cyan-500/15",    text: "text-cyan-400",    border: "border-cyan-500/30" },
  researching:       { bg: "bg-blue-500/15",     text: "text-blue-400",    border: "border-blue-500/30" },
  planning:          { bg: "bg-indigo-500/15",   text: "text-indigo-400",  border: "border-indigo-500/30" },
  producing_content: { bg: "bg-purple-500/15",   text: "text-purple-400",  border: "border-purple-500/30" },
  reviewing:         { bg: "bg-yellow-500/15",   text: "text-yellow-400",  border: "border-yellow-500/30" },
  executing:         { bg: "bg-lime-500/15",     text: "text-lime-400",    border: "border-lime-500/30" },
  observing:         { bg: "bg-emerald-500/15",  text: "text-emerald-400", border: "border-emerald-500/30" },
  adapting:          { bg: "bg-orange-500/15",   text: "text-orange-400",  border: "border-orange-500/30" },
  learning:          { bg: "bg-pink-500/15",     text: "text-pink-400",    border: "border-pink-500/30" },
  scaling:           { bg: "bg-teal-500/15",     text: "text-teal-400",    border: "border-teal-500/30" },
  paused:            { bg: "bg-white/5",         text: "text-gray-400",    border: "border-white/10" },
  churned:           { bg: "bg-red-500/15",      text: "text-red-400",     border: "border-red-500/30" },
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

  // Scope workspaces to current user's memberships
  // Only show all workspaces in dev mode (AUTH_DISABLED=true)
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
          <p className="eyebrow mb-2">Control Plane</p>
          <h1 className="text-xl font-bold tracking-[-0.04em] text-white">
            Client Workspaces
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Each workspace is an autonomous growth runtime for a client
          </p>
        </div>
        <Link
          href="/dashboard/workspaces/new"
          className="btn-primary px-4 py-2 text-xs"
        >
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
        <div className="panel-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center border border-white/10 bg-white/[0.03]">
            <svg
              className="h-8 w-8 text-slate-600"
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
          <h3 className="text-lg font-bold uppercase tracking-[-0.02em] text-gray-200">
            No workspaces yet
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            Create a workspace to start managing autonomous growth for a client.
            Each workspace gets its own strategy, campaigns, creatives, and
            learning memory.
          </p>
          <Link
            href="/dashboard/workspaces/new"
            className="btn-primary mt-6 inline-flex px-5 py-2.5 text-xs"
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
                className="card flex items-center justify-between p-5 transition-all hover:border-white/10 hover:bg-white/[0.03] group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-sm font-semibold text-white group-hover:text-accent transition-colors">
                        {w.name}
                      </h3>
                      <span className={`badge ${colors.bg} ${colors.text} ${colors.border}`}>
                        {w.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      {w._count.campaigns} campaigns · {w._count.tasks} tasks · {w._count.connectedAccounts} platforms
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  {spend > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Spend</p>
                      <p className="text-sm font-medium text-white">
                        {formatCurrency(spend)}
                      </p>
                    </div>
                  )}
                  {roas !== null && (
                    <div className="text-right">
                      <p className="text-xs text-slate-500">ROAS</p>
                      <p
                        className={`text-sm font-medium ${roas >= 2 ? "text-accent" : roas >= 1 ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {roas.toFixed(2)}x
                      </p>
                    </div>
                  )}
                  <svg
                    className="h-4 w-4 text-slate-700 group-hover:text-slate-400 transition-colors"
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
              className={`badge ${colors.bg} ${colors.text} ${colors.border}`}
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
    <div className="card p-5">
      <p className="eyebrow mb-3">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? "text-accent" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
