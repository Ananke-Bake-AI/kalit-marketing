/**
 * Campaign Launch API
 *
 * POST — Approve and launch a campaign to its target platform
 * PATCH — Update campaign status (approve, pause, resume)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kalit/db";
import {
  executeCampaign,
  executeCampaignAllPlatforms,
} from "@/lib/engine/campaign-executor";
import { getAdapter, type AdCredentials } from "@/lib/adapters";
import { getValidCredentials } from "@/lib/oauth/refresh";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ workspaceId: string; campaignId: string }>;
}

/**
 * POST /api/workspaces/:workspaceId/campaigns/:campaignId/launch
 *
 * Body: { platform?: string }
 * - If platform is specified, launch to that platform only.
 * - If omitted, auto-detect from campaign type + connected accounts.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { workspaceId, campaignId } = await ctx.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  // Verify campaign exists and belongs to workspace
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, workspaceId: true, status: true, name: true },
  });

  if (!campaign || campaign.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Only allow launching from draft, approved, or failed states
  const launchableStatuses = ["draft", "approved", "failed", "pending_approval"];
  if (!launchableStatuses.includes(campaign.status)) {
    return NextResponse.json(
      {
        error: `Cannot launch campaign in "${campaign.status}" status. Must be draft, approved, or failed.`,
      },
      { status: 400 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const platform = body.platform as string | undefined;

    let results;
    if (platform) {
      results = [await executeCampaign(campaignId, platform)];
    } else {
      results = await executeCampaignAllPlatforms(campaignId);
    }

    const allSuccess = results.every((r) => r.success);
    const anySuccess = results.some((r) => r.success);

    return NextResponse.json(
      {
        success: anySuccess,
        results,
        summary: {
          total: results.length,
          succeeded: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
        },
      },
      { status: allSuccess ? 200 : anySuccess ? 207 : 422 }
    );
  } catch (err) {
    console.error("[launch] Error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Launch failed",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workspaces/:workspaceId/campaigns/:campaignId/launch
 *
 * Body: { action: "approve" | "pause" | "resume" | "reject" }
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { workspaceId, campaignId } = await ctx.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, workspaceId: true, status: true, platformCampaignIds: true },
  });

  if (!campaign || campaign.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const body = await req.json();
  const action = body.action as string;

  const transitions: Record<string, { from: string[]; to: string }> = {
    approve: {
      from: ["draft", "pending_approval"],
      to: "approved",
    },
    reject: {
      from: ["draft", "pending_approval", "approved"],
      to: "draft",
    },
    pause: {
      from: ["active", "optimizing", "scaling"],
      to: "paused",
    },
    resume: {
      from: ["paused"],
      to: "active",
    },
    remove: {
      from: ["active", "paused", "optimizing", "scaling", "failed", "completed"],
      to: "archived",
    },
    browser_deployed: {
      from: ["draft", "pending_approval", "approved", "failed"],
      to: "active",
    },
  };

  const transition = transitions[action];
  if (!transition) {
    return NextResponse.json(
      { error: `Unknown action: ${action}. Use: approve, reject, pause, resume, remove.` },
      { status: 400 }
    );
  }

  if (!transition.from.includes(campaign.status)) {
    return NextResponse.json(
      {
        error: `Cannot ${action} campaign in "${campaign.status}" status.`,
      },
      { status: 400 }
    );
  }

  // For pause, resume, remove — call the platform adapter to propagate to ad platforms
  const platformIds = (campaign.platformCampaignIds as Record<string, string>) ?? {};
  const platformErrors: string[] = [];

  if (["pause", "resume", "remove"].includes(action) && Object.keys(platformIds).length > 0) {
    for (const [platform, platformCampaignId] of Object.entries(platformIds)) {
      try {
        const adapter = getAdapter(platform);
        if (!adapter) continue;

        const account = await prisma.connectedAccount.findFirst({
          where: { workspaceId, platform: platform as never, isActive: true },
        });
        if (!account) continue;

        const creds = await getValidCredentials(account.id);
        const adCredentials: AdCredentials = {
          accessToken: creds.accessToken,
          refreshToken: creds.refreshToken,
          accountId: account.accountId,
          metadata: (account.metadata as Record<string, string>) ?? {},
        };

        if (action === "pause") {
          await adapter.pauseCampaign(adCredentials, platformCampaignId);
        } else if (action === "resume") {
          await adapter.resumeCampaign(adCredentials, platformCampaignId);
        } else if (action === "remove") {
          await adapter.removeCampaign(adCredentials, platformCampaignId);
        }
      } catch (err) {
        platformErrors.push(
          `${platform}: ${err instanceof Error ? err.message : "platform action failed"}`
        );
      }
    }
  }

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: transition.to as never },
  });

  // Map actions to valid EventType enum values
  const eventTypeMap: Record<string, string> = {
    approve: "approval_granted",
    reject: "approval_denied",
    pause: "campaign_paused",
    resume: "campaign_launched",
    remove: "campaign_paused",
    browser_deployed: "campaign_launched",
  };

  await prisma.event.create({
    data: {
      workspaceId,
      type: (eventTypeMap[action] ?? "agent_action_taken") as never,
      data: { campaignId, action, from: campaign.status, to: transition.to },
    },
  });

  return NextResponse.json({
    success: true,
    campaign: { id: updated.id, status: updated.status },
    platformErrors: platformErrors.length > 0 ? platformErrors : undefined,
  });
}
