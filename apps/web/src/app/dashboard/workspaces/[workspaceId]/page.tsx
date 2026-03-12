import { prisma } from "@kalit/db";
import { notFound } from "next/navigation";
import {
  Layers,
  Activity,
  TrendingUp,
  Brain,
  Megaphone,
  Palette,
  FlaskConical,
  Clock,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { TaskPipelineLive, EventFeedLive } from "@/components/war-room-live";

interface WorkspacePageProps {
  params: Promise<{ workspaceId: string }>;
}

const lifecycleSteps = [
  { key: "onboarding", label: "Understand" },
  { key: "researching", label: "Research" },
  { key: "planning", label: "Plan" },
  { key: "producing_content", label: "Produce" },
  { key: "executing", label: "Execute" },
  { key: "observing", label: "Observe" },
  { key: "adapting", label: "Adapt" },
  { key: "learning", label: "Learn" },
];

const statusColors: Record<string, string> = {
  onboarding: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  researching: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  planning: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  producing_content: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  reviewing: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  executing: "bg-accent/15 text-accent border-accent/30",
  observing: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  adapting: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  learning: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  scaling: "bg-accent/15 text-accent border-accent/30",
  paused: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  churned: "bg-red-500/15 text-red-400 border-red-500/30",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { workspaceId } = await params;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) notFound();

  // Fetch all data in parallel
  const [
    campaigns,
    tasks,
    experiments,
    memories,
    recentEvents,
    connectedAccounts,
  ] = await Promise.all([
    prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: { spend: "desc" },
    }),
    prisma.task.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.experiment.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.memory.findMany({
      where: { workspaceId },
      orderBy: { confidence: "desc" },
      take: 8,
    }),
    prisma.event.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.connectedAccount.findMany({
      where: { workspaceId, isActive: true },
    }),
  ]);

  const activeTasks = tasks.filter(
    (t) => !["completed", "failed", "archived"].includes(t.status)
  );
  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : null;

  const currentStepIndex = lifecycleSteps.findIndex(
    (s) => s.key === workspace.status
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="eyebrow mb-2">Growth Runtime</p>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-[-0.04em] text-white">
            {workspace.name}
          </h1>
          <span
            className={`badge ${statusColors[workspace.status] || "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"}`}
          >
            {workspace.status.replace(/_/g, " ")}
          </span>
          {connectedAccounts.length > 0 && (
            <span className="badge bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              {connectedAccounts.length} platform
              {connectedAccounts.length > 1 ? "s" : ""} connected
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {workspace.status === "onboarding"
            ? "Complete setup to begin the autonomous growth cycle"
            : `Runtime active — ${activeTasks.length} tasks in pipeline`}
        </p>
      </div>

      {/* Lifecycle progress */}
      <div className="panel-surface mb-8 p-5">
        <p className="eyebrow mb-4">Growth Lifecycle</p>
        <div className="flex items-center gap-1">
          {lifecycleSteps.map((step, i) => {
            const isPast = i < currentStepIndex;
            const isCurrent = i === currentStepIndex;
            return (
              <div key={step.key} className="flex items-center gap-1">
                {i > 0 && (
                  <span
                    className={`text-[10px] ${isPast || isCurrent ? "text-accent/50" : "text-slate-700"}`}
                  >
                    &rsaquo;
                  </span>
                )}
                <div
                  className={`px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] ${
                    isCurrent
                      ? "border border-accent/30 bg-accent/20 text-accent"
                      : isPast
                        ? "border border-accent/10 bg-accent/5 text-accent/60"
                        : "border border-white/5 bg-white/[0.03] text-slate-600"
                  }`}
                >
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard icon={Layers} label="Active Tasks" value={String(activeTasks.length)} />
        <StatCard icon={Megaphone} label="Campaigns" value={String(activeCampaigns.length)} />
        <StatCard
          icon={TrendingUp}
          label="Total Spend"
          value={formatCurrency(totalSpend)}
        />
        <StatCard
          icon={TrendingUp}
          label="Revenue"
          value={formatCurrency(totalRevenue)}
          highlight={totalRevenue > 0}
        />
        <StatCard
          icon={Shield}
          label="ROAS"
          value={roas ? `${roas.toFixed(2)}x` : "—"}
          highlight={roas !== null && roas >= 2}
        />
        <StatCard
          icon={FlaskConical}
          label="Experiments"
          value={String(experiments.filter((e) => e.status === "running").length)}
        />
      </div>

      {/* Panels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Pipeline — live polling */}
        <TaskPipelineLive
          workspaceId={workspaceId}
          initialTasks={tasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            family: t.family,
            agentType: t.agentType,
            priority: t.priority,
            createdAt: t.createdAt.toISOString(),
          }))}
        />

        {/* Recent Events — live polling */}
        <EventFeedLive
          workspaceId={workspaceId}
          initialEvents={recentEvents.map((e) => ({
            id: e.id,
            type: e.type,
            data: e.data as Record<string, unknown> | null,
            createdAt: e.createdAt.toISOString(),
          }))}
        />

        {/* Top Campaigns */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-100">
              Top Campaigns
            </h3>
          </div>
          {campaigns.length === 0 ? (
            <EmptyState text="No campaigns yet" />
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {campaigns.slice(0, 6).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-2.5 bg-white/[0.02] border border-white/5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {c.name}
                    </p>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      {c.type}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    <span className="text-[10px] text-slate-400">
                      {formatCurrency(c.spend)}
                    </span>
                    <span
                      className={`text-[10px] font-medium flex items-center gap-0.5 ${
                        (c.roas ?? 0) >= 2
                          ? "text-accent"
                          : (c.roas ?? 0) >= 1
                            ? "text-emerald-400"
                            : "text-red-400"
                      }`}
                    >
                      {(c.roas ?? 0) >= 1 ? (
                        <ArrowUpRight className="h-2.5 w-2.5" />
                      ) : (
                        <ArrowDownRight className="h-2.5 w-2.5" />
                      )}
                      {c.roas ? `${c.roas.toFixed(2)}x` : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Memory */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-100">
              Workspace Memory
            </h3>
            {memories.length > 0 && (
              <span className="text-[10px] text-slate-600 ml-auto">
                {memories.length} active
              </span>
            )}
          </div>
          {memories.length === 0 ? (
            <EmptyState text="No memories stored yet" />
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {memories.map((m) => (
                <div
                  key={m.id}
                  className="p-2.5 bg-white/[0.02] border border-white/5"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 font-medium ${
                        m.type === "winning_angle" || m.type === "audience_insight"
                          ? "bg-accent/20 text-accent"
                          : m.type === "creative_pattern" || m.type === "channel_insight"
                            ? "bg-blue-500/20 text-blue-400"
                            : m.type === "failing_angle"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-zinc-500/20 text-zinc-400"
                      }`}
                    >
                      {m.type}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">
                      {m.title}
                    </span>
                    <span className="text-[10px] text-slate-700 ml-auto shrink-0">
                      {Math.round(m.confidence * 100)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {m.content.length > 120
                      ? m.content.slice(0, 120) + "..."
                      : m.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
        <p className="eyebrow">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${highlight ? "text-accent" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-6 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-700">
        {text}
      </p>
    </div>
  );
}
