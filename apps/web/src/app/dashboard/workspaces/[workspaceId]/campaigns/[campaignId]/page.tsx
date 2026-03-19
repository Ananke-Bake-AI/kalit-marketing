import { prisma } from "@kalit/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Target,
  DollarSign,
  TrendingUp,
  Eye,
  MousePointerClick,
  BarChart3,
  Layers,
  Zap,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { CampaignAdGroupCard } from "@/components/dashboard/campaign-ad-group-card";
import { CampaignActions } from "@/components/dashboard/campaign-actions";
import { CampaignEditPrompt } from "@/components/dashboard/campaign-edit-prompt";
import { CampaignBudgetBreakdown } from "@/components/dashboard/campaign-budget-breakdown";
import { RecommendationsPanel } from "@/components/dashboard/recommendations-panel";
import { CampaignPerformance } from "@/components/dashboard/campaign-performance";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { LoopStatus } from "@/components/dashboard/loop-status";

interface PageProps {
  params: Promise<{ workspaceId: string; campaignId: string }>;
}

const statusConfig: Record<string, { color: string; icon: typeof Clock }> = {
  draft: { color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30", icon: Clock },
  pending_approval: { color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", icon: AlertCircle },
  approved: { color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle },
  launching: { color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: Zap },
  active: { color: "bg-accent/15 text-accent border-accent/30", icon: Zap },
  paused: { color: "bg-orange-500/15 text-orange-400 border-orange-500/30", icon: Clock },
  optimizing: { color: "bg-purple-500/15 text-purple-400 border-purple-500/30", icon: TrendingUp },
  completed: { color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30", icon: CheckCircle },
  failed: { color: "bg-red-500/15 text-red-400 border-red-500/30", icon: AlertCircle },
};

const typeLabels: Record<string, string> = {
  paid_search: "Paid Search",
  paid_social: "Paid Social",
  display: "Display",
  video: "Video",
  retargeting: "Retargeting",
  organic_social: "Organic Social",
  email: "Email",
  seo_content: "SEO Content",
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

export default async function CampaignDetailPage({ params }: PageProps) {
  const { workspaceId, campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      workspace: { select: { name: true } },
      adGroups: {
        include: {
          creatives: {
            include: {
              creative: {
                select: {
                  id: true,
                  type: true,
                  status: true,
                  title: true,
                  content: true,
                  messagingAngle: true,
                  tags: true,
                  impressions: true,
                  clicks: true,
                  conversions: true,
                },
              },
            },
          },
          audience: true,
        },
        orderBy: { createdAt: "asc" },
      },
      experiment: true,
    },
  });

  if (!campaign || campaign.workspaceId !== workspaceId) notFound();

  const connectedAccounts = await prisma.connectedAccount.findMany({
    where: {
      workspaceId,
      isActive: true,
      platform: { in: ["meta", "google", "tiktok", "x", "linkedin", "reddit"] as never[] },
    },
    select: { platform: true, accountName: true, id: true },
  });

  const workspaceConfig = await prisma.workspaceConfig.findUnique({
    where: { workspaceId },
    select: { monthlyBudget: true, targetCac: true, targetRoas: true, currency: true },
  });

  const totalAdGroups = campaign.adGroups.length;
  const totalCreatives = campaign.adGroups.reduce(
    (s, ag) => s + ag.creatives.length,
    0
  );
  const totalKeywords = campaign.adGroups.reduce((s, ag) => {
    const targeting = ag.targeting as Record<string, unknown> | null;
    const kw = (targeting?.keywords as string[]) || [];
    return s + kw.length;
  }, 0);

  const sc = statusConfig[campaign.status] || statusConfig.draft;
  const StatusIcon = sc.icon;

  // Platform detection
  const platformColors: Record<string, { bg: string; text: string; label: string }> = {
    google: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Google Ads" },
    meta: { bg: "bg-indigo-500/15", text: "text-indigo-400", label: "Meta Ads" },
    tiktok: { bg: "bg-pink-500/15", text: "text-pink-400", label: "TikTok Ads" },
    reddit: { bg: "bg-orange-500/15", text: "text-orange-400", label: "Reddit Ads" },
    linkedin: { bg: "bg-sky-500/15", text: "text-sky-400", label: "LinkedIn Ads" },
    x: { bg: "bg-zinc-500/15", text: "text-zinc-300", label: "X Ads" },
  };
  const campaignPlatform = campaign.platform ?? null;
  const platformInfo = campaignPlatform ? platformColors[campaignPlatform] : null;
  const hasMatchingConnection = connectedAccounts.some(
    (a) => a.platform === campaignPlatform
  );
  const incompatibleConnections = connectedAccounts.filter(
    (a) => a.platform !== campaignPlatform
  );

  const budgetUsedPercent =
    campaign.totalBudget && campaign.totalBudget > 0
      ? Math.min((campaign.spend / campaign.totalBudget) * 100, 100)
      : 0;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-xs text-slate-500">
        <Link
          href={`/dashboard/workspaces/${workspaceId}`}
          className="hover:text-white transition-colors"
        >
          {campaign.workspace.name}
        </Link>
        <span>&rsaquo;</span>
        <span className="text-slate-400">Campaigns</span>
        <span>&rsaquo;</span>
        <span className="text-white">{campaign.name}</span>
      </div>

      {/* Back link */}
      <Link
        href={`/dashboard/workspaces/${workspaceId}`}
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to dashboard
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-bold tracking-[-0.04em] text-white">
                {campaign.name}
              </h1>
              {platformInfo && (
                <span className={`badge ${platformInfo.bg} ${platformInfo.text} border-current/30`}>
                  {platformInfo.label}
                </span>
              )}
              {!campaignPlatform && (
                <span className="badge bg-yellow-500/15 text-yellow-400 border-yellow-500/30">
                  No platform assigned
                </span>
              )}
              <span className={`badge ${sc.color}`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {campaign.status.replace(/_/g, " ")}
              </span>
              <span className="badge bg-blue-500/15 text-blue-400 border-blue-500/30">
                {typeLabels[campaign.type] || campaign.type}
              </span>
            </div>
            {campaign.objective && (
              <p className="text-xs text-slate-500">
                Objective: <span className="text-slate-300">{campaign.objective}</span>
              </p>
            )}
          </div>

          {/* Budget card */}
          <div className="card p-4 min-w-[200px] shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-3.5 w-3.5 text-slate-500" />
              <p className="eyebrow">Budget</p>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-lg font-bold text-white">
                {campaign.dailyBudget ? `${formatCurrency(campaign.dailyBudget)}/day` : "—"}
              </p>
              {campaign.totalBudget && (
                <p className="text-xs text-slate-500">
                  / {formatCurrency(campaign.totalBudget)} total
                </p>
              )}
            </div>
            {campaign.totalBudget && campaign.totalBudget > 0 && (
              <div className="mt-2">
                <div className="h-1.5 bg-white/5 w-full">
                  <div
                    className="h-full bg-accent/60"
                    style={{ width: `${budgetUsedPercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-600 mt-1">
                  {formatCurrency(campaign.spend)} spent ({budgetUsedPercent.toFixed(0)}%)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <CampaignActions
            campaignId={campaignId}
            workspaceId={workspaceId}
            status={campaign.status}
            platformCampaignIds={campaign.platformCampaignIds as Record<string, string> | null}
            hasConnectedAccounts={connectedAccounts.length > 0}
            campaignPlatform={campaignPlatform}
            connectedAccounts={connectedAccounts.map(a => ({ id: a.id, platform: a.platform, accountName: a.accountName }))}
          />
        </div>
        <CampaignEditPrompt
          campaignId={campaignId}
          workspaceId={workspaceId}
        />
      </div>

      {/* Deployment Platform */}
      {campaignPlatform && (
        <div className="card p-4 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 flex items-center justify-center ${platformInfo!.bg}`}>
                <Target className={`h-4 w-4 ${platformInfo!.text}`} />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">
                  Deploy to {platformInfo!.label}
                </p>
                {hasMatchingConnection ? (
                  <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="h-2.5 w-2.5" />
                    Connected — {connectedAccounts.find(a => a.platform === campaignPlatform)?.accountName || "Account linked"}
                  </p>
                ) : (
                  <p className="text-[10px] text-yellow-400 flex items-center gap-1">
                    <AlertCircle className="h-2.5 w-2.5" />
                    No {platformInfo!.label} account connected
                  </p>
                )}
              </div>
            </div>
            {!hasMatchingConnection && connectedAccounts.length > 0 && (
              <div className="text-right">
                <p className="text-[10px] text-slate-500">
                  Available: {connectedAccounts.map(a => {
                    const pi = platformColors[a.platform];
                    return pi?.label || a.platform;
                  }).join(", ")}
                </p>
                <p className="text-[10px] text-amber-400 mt-0.5">
                  Deploying to a different platform may cause compatibility issues
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {!campaignPlatform && connectedAccounts.length > 0 && (
        <div className="card p-4 mb-8 border-yellow-500/20">
          <div className="flex items-center gap-2 text-xs text-yellow-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <p>
              No target platform assigned to this campaign. The deployment agent will attempt to detect the best match from your connected accounts ({connectedAccounts.map(a => platformColors[a.platform]?.label || a.platform).join(", ")}).
            </p>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <StatCard icon={Eye} label="Impressions" value={formatNumber(campaign.impressions)} />
        <StatCard icon={MousePointerClick} label="Clicks" value={formatNumber(campaign.clicks)} />
        <StatCard icon={Target} label="Conversions" value={formatNumber(campaign.conversions)} />
        <StatCard icon={DollarSign} label="Spend" value={formatCurrency(campaign.spend)} />
        <StatCard icon={TrendingUp} label="Revenue" value={formatCurrency(campaign.revenue)} highlight={campaign.revenue > 0} />
        <StatCard
          icon={BarChart3}
          label="ROAS"
          value={campaign.roas ? `${campaign.roas.toFixed(2)}x` : "—"}
          highlight={campaign.roas !== null && campaign.roas >= 2}
        />
      </div>

      {/* Performance Data — live metrics over time */}
      {["active", "optimizing", "scaling", "paused", "completed"].includes(campaign.status) && (
        <div className="mb-8">
          <CampaignPerformance workspaceId={workspaceId} campaignId={campaignId} />
        </div>
      )}

      {/* Budget Breakdown */}
      <CampaignBudgetBreakdown
        campaign={{
          dailyBudget: campaign.dailyBudget,
          totalBudget: campaign.totalBudget,
          spend: campaign.spend,
          revenue: campaign.revenue,
          currency: campaign.currency,
          objective: campaign.objective,
          type: campaign.type,
          status: campaign.status,
          createdAt: campaign.createdAt,
          platform: campaignPlatform,
        }}
        adGroups={campaign.adGroups.map((ag) => ({
          name: ag.name,
          dailyBudget: ag.dailyBudget,
          spend: ag.spend,
          impressions: ag.impressions,
          clicks: ag.clicks,
          conversions: ag.conversions,
        }))}
        workspaceConfig={workspaceConfig}
      />

      {/* AI Recommendations (pending approval) */}
      <div className="mb-8">
        <RecommendationsPanel workspaceId={workspaceId} campaignId={campaignId} />
      </div>

      {/* Autonomous Loop + Activity */}
      {["active", "optimizing", "scaling", "paused", "monitoring"].includes(campaign.status) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <LoopStatus workspaceId={workspaceId} />
          <ActivityFeed workspaceId={workspaceId} campaignId={campaignId} limit={10} />
        </div>
      )}

      {/* Strategy Section */}
      {(campaign.targetAudience || campaign.messagingAngle || campaign.hypothesis) && (
        <div className="card p-5 mb-8">
          <p className="eyebrow mb-4">Strategy & Hypothesis</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {campaign.targetAudience && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600 mb-1">
                  Target Audience
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {campaign.targetAudience}
                </p>
              </div>
            )}
            {campaign.messagingAngle && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600 mb-1">
                  Messaging Angle
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {campaign.messagingAngle}
                </p>
              </div>
            )}
            {campaign.hypothesis && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600 mb-1">
                  Hypothesis
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {campaign.hypothesis}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary bar */}
      <div className="flex items-center gap-6 mb-4">
        <p className="eyebrow flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          Ad Groups ({totalAdGroups})
        </p>
        <p className="text-[10px] text-slate-600">
          {totalCreatives} creative{totalCreatives !== 1 ? "s" : ""} · {totalKeywords} keyword{totalKeywords !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Ad Groups */}
      <div className="space-y-3 mb-8">
        {campaign.adGroups.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-slate-500">No ad groups yet</p>
          </div>
        ) : (
          campaign.adGroups.map((ag) => (
            <CampaignAdGroupCard
              key={ag.id}
              adGroup={{
                id: ag.id,
                name: ag.name,
                targeting: ag.targeting as Record<string, unknown> | null,
                placements: ag.placements as string[] | null,
                dailyBudget: ag.dailyBudget,
                impressions: ag.impressions,
                clicks: ag.clicks,
                conversions: ag.conversions,
                spend: ag.spend,
                creatives: ag.creatives.map((agc) => ({
                  id: agc.id,
                  isActive: agc.isActive,
                  impressions: agc.impressions,
                  clicks: agc.clicks,
                  conversions: agc.conversions,
                  spend: agc.spend,
                  creative: {
                    id: agc.creative.id,
                    type: agc.creative.type,
                    status: agc.creative.status,
                    title: agc.creative.title,
                    content: agc.creative.content as Record<string, unknown>,
                    messagingAngle: agc.creative.messagingAngle,
                    tags: agc.creative.tags,
                  },
                })),
              }}
            />
          ))
        )}
      </div>

      {/* Experiment link */}
      {campaign.experiment && (
        <div className="card p-4 mb-8">
          <p className="eyebrow mb-2">Linked Experiment</p>
          <div className="flex items-center gap-3">
            <Zap className="h-4 w-4 text-purple-400" />
            <p className="text-sm text-white">{campaign.experiment.name}</p>
            <span className="badge bg-purple-500/15 text-purple-400 border-purple-500/30">
              {campaign.experiment.status}
            </span>
          </div>
        </div>
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
    <div className="card p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3 w-3 text-slate-500" />
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      </div>
      <p className={`text-xl font-bold ${highlight ? "text-accent" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
