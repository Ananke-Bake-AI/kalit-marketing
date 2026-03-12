/**
 * Reporting Engine
 *
 * Generates growth reports with performance data AND action explanations.
 * Not just metrics — also "why the system did what it did."
 */

import { prisma } from "@kalit/db";
import { computeMeasurementConfidence } from "../tracking/measurement";

export interface GrowthReport {
  workspace: {
    id: string;
    name: string;
    status: string;
  };
  period: { start: string; end: string };
  measurementConfidence: {
    overall: number;
    factors: Record<string, number>;
  };
  performance: {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalRevenue: number;
    avgCtr: number | null;
    avgCpc: number | null;
    avgCpa: number | null;
    roas: number | null;
  };
  campaigns: CampaignSummary[];
  actions: ActionExplanation[];
  experiments: ExperimentSummary[];
  memoriesGained: number;
  tasksCompleted: number;
  tasksFailed: number;
}

interface CampaignSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  cpa: number | null;
  roas: number | null;
}

interface ActionExplanation {
  timestamp: string;
  type: string;
  description: string;
  reason: string;
}

interface ExperimentSummary {
  id: string;
  name: string;
  status: string;
  hypothesis: string;
  winner: string | null;
  confidence: number | null;
}

/**
 * Generate a growth report for a workspace over a date range.
 */
export async function generateReport(
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<GrowthReport> {
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
  });

  // Get campaigns
  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId },
    orderBy: { spend: "desc" },
  });

  // Aggregate performance
  const performance = campaigns.reduce(
    (acc, c) => ({
      totalSpend: acc.totalSpend + c.spend,
      totalImpressions: acc.totalImpressions + c.impressions,
      totalClicks: acc.totalClicks + c.clicks,
      totalConversions: acc.totalConversions + c.conversions,
      totalRevenue: acc.totalRevenue + c.revenue,
    }),
    {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalRevenue: 0,
    }
  );

  // Get action-explaining events
  const events = await prisma.event.findMany({
    where: {
      workspaceId,
      createdAt: { gte: startDate, lte: endDate },
      type: {
        in: [
          "budget_reallocated",
          "creative_rotated",
          "campaign_paused",
          "campaign_launched",
          "campaign_budget_changed",
          "workspace_status_changed",
          "agent_action_taken",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Get experiments
  const experiments = await prisma.experiment.findMany({
    where: {
      workspaceId,
      OR: [
        { status: "running" },
        {
          completedAt: { gte: startDate, lte: endDate },
        },
      ],
    },
  });

  // Count tasks
  const taskStats = await prisma.task.groupBy({
    by: ["status"],
    where: {
      workspaceId,
      completedAt: { gte: startDate, lte: endDate },
    },
    _count: true,
  });

  const tasksCompleted =
    taskStats.find((t) => t.status === "completed")?._count || 0;
  const tasksFailed =
    taskStats.find((t) => t.status === "failed")?._count || 0;

  // Count new memories
  const memoriesGained = await prisma.memory.count({
    where: {
      workspaceId,
      createdAt: { gte: startDate, lte: endDate },
    },
  });

  // Measurement confidence
  const confidence = await computeMeasurementConfidence(workspaceId);

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      status: workspace.status,
    },
    period: {
      start: startDate.toISOString().split("T")[0],
      end: endDate.toISOString().split("T")[0],
    },
    measurementConfidence: confidence,
    performance: {
      ...performance,
      avgCtr:
        performance.totalImpressions > 0
          ? performance.totalClicks / performance.totalImpressions
          : null,
      avgCpc:
        performance.totalClicks > 0
          ? performance.totalSpend / performance.totalClicks
          : null,
      avgCpa:
        performance.totalConversions > 0
          ? performance.totalSpend / performance.totalConversions
          : null,
      roas:
        performance.totalSpend > 0
          ? performance.totalRevenue / performance.totalSpend
          : null,
    },
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      spend: c.spend,
      impressions: c.impressions,
      clicks: c.clicks,
      conversions: c.conversions,
      revenue: c.revenue,
      cpa: c.cpa,
      roas: c.roas,
    })),
    actions: events.map((e) => {
      const data = e.data as Record<string, unknown> | null;
      return {
        timestamp: e.createdAt.toISOString(),
        type: e.type,
        description: formatEventDescription(e.type, data),
        reason: (data?.reason as string) || "Autonomous decision",
      };
    }),
    experiments: experiments.map((e) => ({
      id: e.id,
      name: e.name,
      status: e.status,
      hypothesis: e.hypothesis,
      winner: e.winnerVariant,
      confidence: e.confidence,
    })),
    memoriesGained,
    tasksCompleted,
    tasksFailed,
  };
}

function formatEventDescription(
  type: string,
  data: Record<string, unknown> | null
): string {
  switch (type) {
    case "budget_reallocated":
      return `Budget reallocated: moved $${data?.amount || "?"} from ${data?.from || "?"} to ${data?.to || "?"}`;
    case "creative_rotated":
      return `Creative rotated: replaced fatigued asset ${data?.oldCreativeId || "?"} with ${data?.newCreativeId || "?"}`;
    case "campaign_paused":
      return `Campaign paused: ${data?.campaignName || data?.campaignId || "?"}`;
    case "campaign_launched":
      return `Campaign launched: ${data?.campaignName || data?.campaignId || "?"}`;
    case "campaign_budget_changed":
      return `Budget changed: ${data?.campaignName || "?"} from $${data?.oldBudget || "?"} to $${data?.newBudget || "?"}`;
    case "workspace_status_changed":
      return `Workspace transitioned from ${data?.from || "?"} to ${data?.to || "?"}`;
    case "agent_action_taken":
      return `Agent ${data?.agentType || "?"}: ${data?.action || "?"}`;
    default:
      return type.replace(/_/g, " ");
  }
}
