export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@kalit/db";
import { auth } from "@/lib/auth";

const lifecycleColors: Record<string, { bg: string; text: string }> = {
  onboarding:        { bg: "bg-cyan-100",    text: "text-cyan-700" },
  researching:       { bg: "bg-blue-100",    text: "text-blue-700" },
  planning:          { bg: "bg-indigo-100",  text: "text-indigo-700" },
  producing_content: { bg: "bg-purple-100",  text: "text-purple-700" },
  reviewing:         { bg: "bg-yellow-100",  text: "text-yellow-700" },
  executing:         { bg: "bg-lime-100",    text: "text-lime-700" },
  observing:         { bg: "bg-emerald-100", text: "text-emerald-700" },
  adapting:          { bg: "bg-orange-100",  text: "text-orange-700" },
  learning:          { bg: "bg-pink-100",    text: "text-pink-700" },
  scaling:           { bg: "bg-teal-100",    text: "text-teal-700" },
  paused:            { bg: "bg-gray-100",    text: "text-gray-500" },
  churned:           { bg: "bg-red-100",     text: "text-red-700" },
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
                      <span className={`badge ${colors.bg} ${colors.text}`}>
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
            <span key={status} className={`badge ${colors.bg} ${colors.text}`}>
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
