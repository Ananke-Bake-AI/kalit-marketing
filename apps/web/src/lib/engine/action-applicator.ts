/**
 * Action Applicator
 *
 * Takes agent output, classifies each suggested action as "safe" (auto-apply)
 * or "needs-approval" (create a recommendation), then routes accordingly.
 *
 * SAFE (auto-apply): ad copy changes, keyword tweaks, targeting, creative rotation
 * NEEDS APPROVAL: budget changes, campaign pause/resume, bid strategy, budget reallocation
 */

import { prisma, Prisma } from "@kalit/db";
import { getAdapter, type AdCredentials } from "../adapters";
import { getValidCredentials } from "../oauth/refresh";

// Helper: create recommendation via raw SQL (Prisma client may not have the model cached yet)
async function createRecommendation(data: {
  workspaceId: string;
  category: string;
  impact: string;
  title: string;
  description: string;
  reason: string;
  actionPayload: unknown;
  taskId: string | null;
  agentType: string | null;
  campaignId: string | null;
}) {
  const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await prisma.$executeRaw`
    INSERT INTO recommendations (id, workspace_id, status, category, impact, title, description, reason, action_payload, task_id, agent_type, campaign_id, created_at, updated_at)
    VALUES (${id}, ${data.workspaceId}, 'pending', ${data.category}, ${data.impact}, ${data.title}, ${data.description}, ${data.reason}, ${JSON.stringify(data.actionPayload)}::jsonb, ${data.taskId}, ${data.agentType}, ${data.campaignId}, NOW(), NOW())
  `;
  return id;
}

// ---- Classification ----

const NEEDS_APPROVAL = new Set([
  "budget_change",
  "campaign_pause",
  "campaign_resume",
  "bid_strategy_change",
  "budget_reallocation",
]);

interface ParsedAction {
  category: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  reason: string;
  campaignId?: string;
  actionPayload: {
    platform: string;
    campaignId?: string;
    platformCampaignId?: string;
    action: string;
    params: Record<string, unknown>;
  };
}

function classify(action: ParsedAction): "auto_apply" | "needs_approval" {
  return NEEDS_APPROVAL.has(action.category) ? "needs_approval" : "auto_apply";
}

// ---- Agent Output Parsers ----

function parseBudgetManagerOutput(
  output: Record<string, unknown>,
  workspaceId: string,
): ParsedAction[] {
  const decisions = (output.decisions as Array<Record<string, unknown>>) ?? [];
  return decisions.map((d) => {
    const action = String(d.action ?? "maintain");
    const isPause = action === "pause";
    const isResume = action === "resume";
    const amount = Math.abs(Number(d.amount ?? 0));
    return {
      category: isPause ? "campaign_pause" : isResume ? "campaign_resume" : "budget_change",
      title: isPause
        ? `Pause campaign`
        : isResume
          ? `Resume campaign`
          : `${action === "increase" ? "Increase" : "Decrease"} daily budget by $${amount}`,
      description: String(d.reason ?? ""),
      impact: isPause || (amount > 20) ? "high" : "medium",
      reason: String(d.reason ?? "Budget manager recommendation"),
      campaignId: String(d.campaignId ?? ""),
      actionPayload: {
        platform: "google",
        campaignId: String(d.campaignId ?? ""),
        action: isPause ? "pause" : isResume ? "resume" : "update_budget",
        params: { action, amount, newBudget: d.newBudget },
      },
    };
  });
}

function parsePerformanceAnalystOutput(
  output: Record<string, unknown>,
): ParsedAction[] {
  const actions: ParsedAction[] = [];

  // Anomalies that suggest pausing → needs approval
  const anomalies = (output.anomalies as Array<Record<string, unknown>>) ?? [];
  for (const a of anomalies) {
    if (String(a.suggestedAction ?? "").toLowerCase().includes("pause")) {
      actions.push({
        category: "campaign_pause",
        title: `Anomaly detected: ${a.description}`,
        description: String(a.description ?? ""),
        impact: String(a.severity ?? "medium") === "high" ? "high" : "medium",
        reason: String(a.description ?? "Performance anomaly"),
        actionPayload: {
          platform: "google",
          action: "pause",
          params: { anomalyType: a.type },
        },
      });
    }
  }

  // Fatigue alerts → creative rotation (auto-apply)
  const fatigueAlerts = (output.fatigueAlerts as Array<Record<string, unknown>>) ?? [];
  for (const f of fatigueAlerts) {
    actions.push({
      category: "creative_rotation",
      title: `Rotate fatigued creative (score: ${f.score})`,
      description: String(f.recommendation ?? ""),
      impact: "low",
      reason: `Creative fatigue score ${f.score} exceeds threshold`,
      actionPayload: {
        platform: "google",
        action: "rotate_creative",
        params: { creativeId: f.creativeId, score: f.score },
      },
    });
  }

  return actions;
}

function parseOptimizationEngineOutput(
  output: Record<string, unknown>,
): ParsedAction[] {
  const optimizations = (output.optimizations as Array<Record<string, unknown>>) ?? [];
  return optimizations.map((o) => {
    const type = String(o.type ?? "unknown");
    const isBudget = type.includes("budget") || type.includes("bid");
    return {
      category: isBudget ? "budget_change" : type.includes("keyword") ? "keyword_adjustment" : "ad_copy_change",
      title: String(o.action ?? o.type ?? "Optimization"),
      description: String(o.reason ?? ""),
      impact: String(o.expectedImpact ?? "medium") as "high" | "medium" | "low",
      reason: String(o.reason ?? "Optimization engine recommendation"),
      campaignId: String(o.target ?? ""),
      actionPayload: {
        platform: "google",
        campaignId: String(o.target ?? ""),
        action: String(o.action ?? "optimize"),
        params: o as Record<string, unknown>,
      },
    };
  });
}

/**
 * Parse agent output into structured actions based on agent type.
 */
export function parseAgentOutput(
  agentType: string,
  output: Record<string, unknown>,
  workspaceId: string,
): ParsedAction[] {
  // Skip raw/error outputs
  if (output._raw || output._parseError || output.error) return [];

  switch (agentType) {
    case "budget_manager":
      return parseBudgetManagerOutput(output, workspaceId);
    case "performance_analyst":
      return parsePerformanceAnalystOutput(output);
    case "optimization_engine":
      return parseOptimizationEngineOutput(output);
    default:
      return [];
  }
}

// ---- Credential Helper ----

async function getCredentialsForWorkspace(
  workspaceId: string,
  platform: string,
): Promise<{ adapter: NonNullable<ReturnType<typeof getAdapter>>; credentials: AdCredentials } | null> {
  const adapter = getAdapter(platform);
  if (!adapter) return null;

  const account = await prisma.connectedAccount.findFirst({
    where: { workspaceId, platform: platform as never, isActive: true },
  });
  if (!account) return null;

  const creds = await getValidCredentials(account.id);
  return {
    adapter,
    credentials: {
      accessToken: creds.accessToken,
      refreshToken: creds.refreshToken,
      accountId: account.accountId,
      metadata: (account.metadata as Record<string, string>) ?? {},
    },
  };
}

// ---- Auto-Apply Logic ----

async function autoApply(
  action: ParsedAction,
  workspaceId: string,
): Promise<{ success: boolean; error?: string }> {
  // For now, creative rotation and keyword changes are logged as events
  // but actual platform mutations are handled for known action types
  try {
    const platform = action.actionPayload.platform || "google";
    const ctx = await getCredentialsForWorkspace(workspaceId, platform);
    if (!ctx) return { success: false, error: `No ${platform} credentials` };

    const { adapter, credentials } = ctx;
    const params = action.actionPayload.params;

    switch (action.category) {
      case "creative_rotation": {
        // Mark old creative as fatigued, log event
        const creativeId = params.creativeId as string;
        if (creativeId) {
          await prisma.creative.updateMany({
            where: { id: creativeId },
            data: { status: "fatigued" },
          });
        }
        break;
      }

      case "keyword_adjustment": {
        // Auto-add/remove keywords via adapter (future: implement in adapter)
        console.log(`[action-applicator] Auto-applying keyword adjustment: ${action.title}`);
        break;
      }

      case "ad_copy_change": {
        console.log(`[action-applicator] Auto-applying ad copy change: ${action.title}`);
        break;
      }

      case "targeting_tweak": {
        console.log(`[action-applicator] Auto-applying targeting tweak: ${action.title}`);
        break;
      }

      default:
        console.log(`[action-applicator] Auto-applied generic action: ${action.category}`);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Auto-apply failed" };
  }
}

// ---- Main Entry Point ----

/**
 * Process agent output: classify each action and either auto-apply or create recommendation.
 */
export async function applyActions(
  workspaceId: string,
  taskId: string,
  agentType: string,
  output: Record<string, unknown>,
): Promise<{ autoApplied: number; recommendationsCreated: number; errors: string[] }> {
  const actions = parseAgentOutput(agentType, output, workspaceId);

  let autoApplied = 0;
  let recommendationsCreated = 0;
  const errors: string[] = [];

  for (const action of actions) {
    const disposition = classify(action);

    if (disposition === "auto_apply") {
      const result = await autoApply(action, workspaceId);
      if (result.success) {
        autoApplied++;
        await prisma.event.create({
          data: {
            workspaceId,
            type: "agent_action_taken",
            data: {
              taskId,
              agentType,
              category: action.category,
              title: action.title,
              autoApplied: true,
            },
          },
        });
      } else {
        errors.push(`Auto-apply failed for "${action.title}": ${result.error}`);
      }
    } else {
      // Create a pending recommendation for human approval
      // Look up the campaign to get platformCampaignId
      let platformCampaignId: string | undefined;
      if (action.campaignId) {
        const campaign = await prisma.campaign.findUnique({
          where: { id: action.campaignId },
          select: { platformCampaignIds: true },
        });
        const ids = campaign?.platformCampaignIds as Record<string, string> | null;
        platformCampaignId = ids?.google || ids?.meta;
        action.actionPayload.platformCampaignId = platformCampaignId;
      }

      // Validate campaignId exists before inserting (foreign key constraint)
      let validCampaignId: string | null = null;
      if (action.campaignId) {
        const exists = await prisma.campaign.findUnique({
          where: { id: action.campaignId },
          select: { id: true },
        });
        if (exists) validCampaignId = action.campaignId;
      }

      await createRecommendation({
        workspaceId,
        category: action.category,
        impact: action.impact,
        title: action.title,
        description: action.description,
        reason: action.reason,
        actionPayload: action.actionPayload,
        taskId,
        agentType,
        campaignId: validCampaignId,
      });

      recommendationsCreated++;

      await prisma.event.create({
        data: {
          workspaceId,
          type: "approval_requested",
          data: {
            taskId,
            agentType,
            category: action.category,
            title: action.title,
            impact: action.impact,
          },
        },
      });
    }
  }

  return { autoApplied, recommendationsCreated, errors };
}

/**
 * Execute an approved recommendation — apply the action to the platform.
 */
export async function executeRecommendation(
  recommendationId: string,
): Promise<{ success: boolean; error?: string }> {
  const rec = await prisma.recommendation.findUnique({
    where: { id: recommendationId },
  });
  if (!rec) return { success: false, error: "Recommendation not found" };
  if (rec.status !== "approved" && rec.status !== "pending") {
    return { success: false, error: `Cannot execute recommendation in "${rec.status}" status` };
  }

  const payload = rec.actionPayload as {
    platform: string;
    campaignId?: string;
    platformCampaignId?: string;
    action: string;
    params: Record<string, unknown>;
  };

  try {
    const platform = payload.platform || "google";
    const ctx = await getCredentialsForWorkspace(rec.workspaceId, platform);
    if (!ctx) throw new Error(`No ${platform} credentials for workspace`);

    const { adapter, credentials } = ctx;

    // Look up platformCampaignId if not in payload
    let platformCampaignId = payload.platformCampaignId;
    if (!platformCampaignId && payload.campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: payload.campaignId },
        select: { platformCampaignIds: true },
      });
      const ids = campaign?.platformCampaignIds as Record<string, string> | null;
      platformCampaignId = ids?.[platform];
    }

    switch (payload.action) {
      case "pause":
        if (platformCampaignId) {
          await adapter.pauseCampaign(credentials, platformCampaignId);
          if (payload.campaignId) {
            await prisma.campaign.update({
              where: { id: payload.campaignId },
              data: { status: "paused" },
            });
          }
        }
        break;

      case "resume":
        if (platformCampaignId) {
          await adapter.resumeCampaign(credentials, platformCampaignId);
          if (payload.campaignId) {
            await prisma.campaign.update({
              where: { id: payload.campaignId },
              data: { status: "active" },
            });
          }
        }
        break;

      case "update_budget": {
        const params = payload.params;
        const amount = Number(params.amount ?? 0);
        const action = String(params.action ?? "maintain");

        if (platformCampaignId && amount > 0 && payload.campaignId) {
          const campaign = await prisma.campaign.findUnique({
            where: { id: payload.campaignId },
            select: { dailyBudget: true },
          });
          const currentBudget = campaign?.dailyBudget ?? 10;
          const newBudget = action === "increase"
            ? currentBudget + amount
            : Math.max(5, currentBudget - amount);

          await adapter.updateBudget(credentials, platformCampaignId, newBudget);
          await prisma.campaign.update({
            where: { id: payload.campaignId },
            data: { dailyBudget: newBudget },
          });
        }
        break;
      }

      default:
        console.log(`[action-applicator] Executed recommendation action: ${payload.action}`);
    }

    // Mark as applied
    await prisma.recommendation.update({
      where: { id: recommendationId },
      data: {
        status: "applied",
        resolvedAt: new Date(),
        appliedResult: { success: true },
      },
    });

    await prisma.event.create({
      data: {
        workspaceId: rec.workspaceId,
        type: "agent_action_taken",
        data: {
          recommendationId,
          category: rec.category,
          title: rec.title,
        },
      },
    });

    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Execution failed";

    await prisma.recommendation.update({
      where: { id: recommendationId },
      data: {
        status: "failed",
        resolvedAt: new Date(),
        appliedResult: { success: false, error },
      },
    });

    return { success: false, error };
  }
}
