import { prisma } from "@kalit/db";
import { notFound } from "next/navigation";
import Link from "next/link";
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
  ChevronRight,
  DollarSign,
  Share2,
} from "lucide-react";
import { TaskPipelineLive, EventFeedLive } from "@/components/war-room-live";
import { OnboardingGuide } from "@/components/onboarding/onboarding-guide";
import { SupervisorPanel } from "@/components/dashboard/supervisor-panel";
import { ContextAnalyzer } from "@/components/dashboard/context-analyzer";
import { ConnectPlatforms } from "@/components/dashboard/connect-platforms";
import { WorkspaceEdit } from "@/components/dashboard/workspace-edit";

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
  observing: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  adapting: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  learning: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  scaling: "bg-accent/15 text-accent border-accent/30",
  paused: "bg-zinc-500/15 text-text-secondary border-zinc-500/30",
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
    include: { config: true },
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
    creativesCount,
    assetsCount,
    recentSocialPosts,
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
    prisma.creative.count({
      where: { workspaceId },
    }),
    prisma.workspaceAsset?.count({
      where: { workspaceId },
    }).catch(() => 0) ?? Promise.resolve(0),
    prisma.socialPost.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 5,
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

  const showOnboarding = workspace.status === "onboarding";

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="eyebrow mb-2">Growth Runtime</p>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-[-0.04em] text-text">
            {workspace.name}
          </h1>
          <span
            className={`badge ${statusColors[workspace.status] || "bg-zinc-500/15 text-text-secondary border-zinc-500/30"}`}
          >
            {workspace.status.replace(/_/g, " ")}
          </span>
          {connectedAccounts.length > 0 && (
            <span className="badge bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
              {connectedAccounts.length} platform
              {connectedAccounts.length > 1 ? "s" : ""} connected
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-text-secondary">
          {workspace.status === "onboarding"
            ? "Complete setup to begin the autonomous growth cycle"
            : `Runtime active — ${activeTasks.length} tasks in pipeline`}
        </p>
        <div className="mt-3">
          <WorkspaceEdit
            workspaceId={workspaceId}
            initialValues={{
              name: workspace.name,
              productName: workspace.config?.productName,
              productDescription: workspace.config?.productDescription,
              productUrl: workspace.config?.productUrl,
              industry: workspace.config?.industry,
              stage: workspace.config?.stage,
              icpDescription: workspace.config?.icpDescription,
              brandVoice: workspace.config?.brandVoice,
              monthlyBudget: workspace.config?.monthlyBudget,
              targetCac: workspace.config?.targetCac,
              targetRoas: workspace.config?.targetRoas,
              currency: workspace.config?.currency ?? "USD",
              autonomyMode: workspace.config?.autonomyMode,
              primaryGoal: workspace.config?.primaryGoal,
            }}
          />
        </div>
      </div>

      {showOnboarding ? (
        <OnboardingGuide
          workspaceId={workspaceId}
          workspaceName={workspace.name}
          config={
            workspace.config
              ? {
                  productName: workspace.config.productName,
                  productDescription: workspace.config.productDescription,
                  monthlyBudget: workspace.config.monthlyBudget,
                  primaryGoal: workspace.config.primaryGoal,
                  targetCac: workspace.config.targetCac,
                  targetRoas: workspace.config.targetRoas,
                  currency: workspace.config.currency,
                }
              : null
          }
          connectedAccounts={connectedAccounts.map((a) => ({
            id: a.id,
            platform: a.platform,
            accountName: a.accountName,
            isActive: a.isActive,
          }))}
          assetsCount={assetsCount}
          creativesCount={creativesCount}
          campaignsCount={campaigns.length}
          memoriesCount={memories.length}
        />
      ) : (
        <>
          {/* Lifecycle progress */}
          <div className="section-card mb-8 p-5">
            <p className="eyebrow mb-4">Growth Lifecycle</p>
            <div className="flex items-center gap-1">
              {lifecycleSteps.map((step, i) => {
                const isPast = i < currentStepIndex;
                const isCurrent = i === currentStepIndex;
                return (
                  <div key={step.key} className="flex items-center gap-1">
                    {i > 0 && (
                      <span
                        className={`text-[10px] ${isPast || isCurrent ? "text-accent/50" : "text-text-secondary"}`}
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
                            : "rounded-lg border border-divider bg-transparent text-text-secondary"
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
          <div className="mb-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
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
                startedAt: t.startedAt?.toISOString() ?? null,
                completedAt: t.completedAt?.toISOString() ?? null,
                reason: t.reason,
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
            <div className="section-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Megaphone className="h-4 w-4 text-text-secondary" />
                <h3 className="text-sm font-semibold text-text">
                  Campaigns
                </h3>
                <span className="text-[10px] text-text-secondary ml-auto">
                  {campaigns.length} total
                </span>
              </div>
              {campaigns.length === 0 ? (
                <EmptyState text="No campaigns yet" />
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {campaigns.slice(0, 8).map((c) => (
                    <Link
                      key={c.id}
                      href={`/dashboard/workspaces/${workspaceId}/campaigns/${c.id}`}
                      className="flex items-center justify-between p-3 bg-transparent rounded-lg border border-divider hover:border-divider hover:bg-subtle transition-all group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-text truncate group-hover:text-accent transition-colors">
                            {c.name}
                          </p>
                          <span className={`text-[9px] px-1.5 py-0.5 font-medium ${
                            c.status === "active" ? "bg-emerald-500/20 text-emerald-600" :
                            c.status === "draft" ? "bg-zinc-500/20 text-text-secondary" :
                            c.status === "paused" ? "bg-orange-500/20 text-orange-400" :
                            "bg-blue-500/20 text-blue-400"
                          }`}>
                            {c.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-text-secondary">
                            {c.type.replace(/_/g, " ")}
                          </span>
                          {c.dailyBudget && (
                            <span className="text-[10px] text-text-secondary flex items-center gap-0.5">
                              <DollarSign className="h-2.5 w-2.5" />
                              {c.dailyBudget}/d
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-3 shrink-0">
                        <span className="text-[10px] text-text-secondary">
                          {formatCurrency(c.spend)}
                        </span>
                        <span
                          className={`text-[10px] font-medium flex items-center gap-0.5 ${
                            (c.roas ?? 0) >= 2
                              ? "text-accent"
                              : (c.roas ?? 0) >= 1
                                ? "text-emerald-600"
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
                        <ChevronRight className="h-3.5 w-3.5 text-text-secondary group-hover:text-text-secondary transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Memory */}
            <div className="section-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-4 w-4 text-text-secondary" />
                <h3 className="text-sm font-semibold text-text">
                  Workspace Memory
                </h3>
                {memories.length > 0 && (
                  <span className="text-[10px] text-text-secondary ml-auto">
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
                      className="p-2.5 bg-transparent rounded-lg border border-divider"
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
                                  : "bg-zinc-500/20 text-text-secondary"
                          }`}
                        >
                          {m.type}
                        </span>
                        <span className="text-[10px] text-text-secondary truncate">
                          {m.title}
                        </span>
                        <span className="text-[10px] text-text-secondary ml-auto shrink-0">
                          {Math.round(m.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-[11px] text-text-secondary leading-relaxed">
                        {m.content.length > 120
                          ? m.content.slice(0, 120) + "..."
                          : m.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Social Posts */}
            <div className="section-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Share2 className="h-4 w-4 text-text-secondary" />
                <h3 className="text-sm font-semibold text-text">Social Posts</h3>
                <Link
                  href="/dashboard/social"
                  className="ml-auto text-[10px] text-accent hover:underline"
                >
                  Create New
                </Link>
              </div>
              {recentSocialPosts.length === 0 ? (
                <EmptyState text="No social posts yet" />
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {recentSocialPosts.map((post) => {
                    const platformColors: Record<string, string> = {
                      x: "bg-subtle-strong text-text",
                      meta: "bg-pink-500/15 text-pink-400",
                      linkedin: "bg-blue-500/15 text-blue-400",
                      reddit: "bg-orange-500/15 text-orange-400",
                      tiktok: "bg-cyan-500/15 text-cyan-400",
                    };
                    const statusColors: Record<string, string> = {
                      draft: "bg-zinc-500/15 text-text-secondary",
                      published: "bg-emerald-500/15 text-emerald-600",
                      scheduled: "bg-yellow-500/15 text-yellow-400",
                      failed: "bg-red-500/15 text-red-400",
                    };
                    return (
                      <div key={post.id} className="p-2.5 bg-transparent rounded-lg border border-divider">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`badge text-[8px] ${platformColors[post.platform] ?? "bg-subtle-strong text-text"}`}>
                            {post.platform}
                          </span>
                          <span className={`badge text-[8px] ${statusColors[post.status] ?? statusColors.draft}`}>
                            {post.status}
                          </span>
                          <span className="text-[10px] text-text-secondary ml-auto">
                            {timeAgo(post.createdAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-secondary leading-relaxed truncate">
                          {post.content.slice(0, 100)}{post.content.length > 100 ? "..." : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Supervisor + Context */}
            <SupervisorPanel workspaceId={workspaceId} />
            <ContextAnalyzer workspaceId={workspaceId} />

            {/* Connect Platforms — full width */}
            <div className="lg:col-span-2">
              <ConnectPlatforms
                workspaceId={workspaceId}
                connectedAccounts={connectedAccounts.map((a) => ({
                  id: a.id,
                  platform: a.platform,
                  accountName: a.accountName,
                  isActive: a.isActive,
                }))}
              />
            </div>
          </div>
        </>
      )}
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
    <div className="section-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-text-secondary" />
        <p className="eyebrow text-[10px]">{label}</p>
      </div>
      <p className={`text-xl font-bold ${highlight ? "text-accent" : "text-text"}`}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-6 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-secondary">
        {text}
      </p>
    </div>
  );
}
