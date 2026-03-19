/**
 * Task Actions API
 *
 * PATCH — Update task status (approve, reject, cancel, restart)
 * GET — Get single task with full output
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kalit/db";
import { processTask } from "@/lib/engine/agent-router";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ workspaceId: string; taskId: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { workspaceId, taskId } = await ctx.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { workspaceId, taskId } = await ctx.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const body = await req.json();
  const action = body.action as string;

  switch (action) {
    case "approve": {
      if (task.status !== "waiting_approval") {
        return NextResponse.json(
          { error: `Cannot approve task in "${task.status}" status` },
          { status: 400 }
        );
      }
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "completed" },
      });
      await prisma.event.create({
        data: {
          workspaceId,
          type: "task_completed",
          data: { taskId, action: "approved", title: task.title },
        },
      });

      // Materialize output: campaign_architect → create draft campaigns in DB
      if (task.agentType === "campaign_architect" && task.output) {
        const output = task.output as Record<string, unknown>;
        const campaigns = output.campaigns as Array<Record<string, unknown>> | undefined;
        if (campaigns?.length) {
          const created = await materializeCampaigns(workspaceId, campaigns);
          return NextResponse.json({ success: true, status: "completed", campaignsCreated: created });
        }
      }

      return NextResponse.json({ success: true, status: "completed" });
    }

    case "reject": {
      if (task.status !== "waiting_approval") {
        return NextResponse.json(
          { error: `Cannot reject task in "${task.status}" status` },
          { status: 400 }
        );
      }
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "failed", output: { rejected: true, reason: body.reason || "Rejected by user" } as never },
      });
      await prisma.event.create({
        data: {
          workspaceId,
          type: "task_failed",
          data: { taskId, action: "rejected", reason: body.reason || "Rejected by user" },
        },
      });
      return NextResponse.json({ success: true, status: "failed" });
    }

    case "cancel": {
      const cancelable = ["queued", "researching", "generating", "executing"];
      if (!cancelable.includes(task.status)) {
        return NextResponse.json(
          { error: `Cannot cancel task in "${task.status}" status` },
          { status: 400 }
        );
      }
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "failed", output: { cancelled: true } as never, completedAt: new Date() },
      });
      await prisma.event.create({
        data: {
          workspaceId,
          type: "task_failed",
          data: { taskId, action: "cancelled", title: task.title },
        },
      });
      return NextResponse.json({ success: true, status: "failed" });
    }

    case "restart": {
      const restartable = ["failed", "completed"];
      if (!restartable.includes(task.status)) {
        return NextResponse.json(
          { error: `Cannot restart task in "${task.status}" status` },
          { status: 400 }
        );
      }
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "queued", output: null as never, completedAt: null, startedAt: null },
      });
      await prisma.event.create({
        data: {
          workspaceId,
          type: "task_created",
          data: { taskId, action: "restarted", title: task.title },
        },
      });

      // Fire-and-forget: trigger worker to pick up the restarted task
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
      fetch(`${baseUrl}/api/internal/worker/tick`, { method: "GET" }).catch(() => {});

      return NextResponse.json({ success: true, status: "queued" });
    }

    case "run_now": {
      if (task.status !== "queued" && task.status !== "approved") {
        return NextResponse.json(
          { error: `Cannot run task in "${task.status}" status` },
          { status: 400 }
        );
      }

      // Process immediately (don't wait for worker tick)
      const result = await processTask(taskId);
      return NextResponse.json({
        success: result.success,
        status: result.success ? "completed" : "failed",
        error: result.error,
      });
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}. Valid: approve, reject, cancel, restart, run_now` },
        { status: 400 }
      );
  }
}

/**
 * Materialize campaign_architect output into actual Campaign + AdGroup + Creative records.
 * Creates everything as drafts so the user can review before launching.
 */
async function materializeCampaigns(
  workspaceId: string,
  campaigns: Array<Record<string, unknown>>
): Promise<number> {
  let created = 0;

  const config = await prisma.workspaceConfig.findUnique({
    where: { workspaceId },
  });
  const websiteUrl = config?.productUrl || "https://example.com";
  const currency = config?.currency || "USD";

  for (const camp of campaigns) {
    try {
      // Map campaign type to our enum
      const typeMap: Record<string, string> = {
        prospecting: "paid_social",
        search: "paid_search",
        paid_search: "paid_search",
        paid_social: "paid_social",
        display: "display",
        video: "video",
        retargeting: "paid_social",
        community: "content",
        organic: "content",
      };
      const campaignType = typeMap[camp.type as string] || typeMap[camp.platform as string] || "paid_social";

      // Detect target ad platform from campaign name or explicit platform field
      const nameLower = ((camp.name as string) || "").toLowerCase();
      const detectedPlatform =
        (camp.platform as string) ||
        (nameLower.includes("meta") || nameLower.includes("facebook") || nameLower.includes("instagram") ? "meta" :
        nameLower.includes("google") || nameLower.includes("search") ? "google" :
        nameLower.includes("tiktok") ? "tiktok" :
        nameLower.includes("reddit") ? "reddit" :
        nameLower.includes("linkedin") ? "linkedin" :
        nameLower.includes("twitter") || nameLower.includes("_x_") ? "x" :
        null);

      // Extract budget from campaign or use workspace default
      const budget = camp.budget as Record<string, unknown> | undefined;
      const dailyBudget = Number(budget?.daily ?? budget?.dailyBudget ?? config?.monthlyBudget ? (config!.monthlyBudget ?? 500) / 30 : 15);
      const totalBudget = Number(budget?.total ?? budget?.monthly ?? dailyBudget * 30);

      const campaign = await prisma.campaign.create({
        data: {
          workspaceId,
          name: (camp.name as string) || "Untitled Campaign",
          type: campaignType as never,
          platform: detectedPlatform,
          objective: (camp.objective as string) || "conversions",
          status: "draft",
          targetAudience: (camp.targetAudience as string) || "",
          messagingAngle: (camp.messagingAngle as string) || "",
          hypothesis: (camp.hypothesis as string) || "",
          dailyBudget,
          totalBudget,
          currency,
        },
      });

      // Create ad groups
      const adGroups = (camp.adGroups as Array<Record<string, unknown>>) || [];
      for (const agData of adGroups) {
        const targeting = (agData.targeting as Record<string, unknown>) || {};
        const adGroup = await prisma.adGroup.create({
          data: {
            campaignId: campaign.id,
            name: (agData.name as string) || "Ad Group",
            targeting: targeting as object,
            placements: (agData.placements as string[]) || [],
          },
        });

        // Create creatives from creativeSpecs or ads
        const specs = (agData.creativeSpecs as Array<Record<string, unknown>>)
          || (agData.ads as Array<Record<string, unknown>>)
          || [];
        for (const spec of specs) {
          const creative = await prisma.creative.create({
            data: {
              workspaceId,
              type: "ad_copy",
              status: "draft",
              version: 1,
              title: (spec.hook as string) || (spec.headline as string) || (spec.body as string) || "Creative",
              content: {
                headline: spec.hook || spec.headline || "",
                headlines: (spec.headlines as string[]) || [],
                body: spec.body || "",
                cta: spec.cta || "",
                destinationUrl: (spec.destinationUrl as string) || websiteUrl,
                descriptions: (spec.descriptions as string[]) || [],
                format: spec.format || "",
                duration: spec.duration || "",
                style: spec.style || "",
              },
              messagingAngle: (spec.messagingAngle as string) ?? null,
              tags: (spec.tags as string[]) || [],
            },
          });
          await prisma.adGroupCreative.create({
            data: {
              adGroupId: adGroup.id,
              creativeId: creative.id,
              isActive: true,
            },
          });
        }
      }

      created++;

      await prisma.event.create({
        data: {
          workspaceId,
          type: "task_completed" as never,
          data: {
            action: "campaign_materialized",
            campaignId: campaign.id,
            name: campaign.name,
            adGroups: adGroups.length,
            source: "campaign_architect",
          },
        },
      });
    } catch (err) {
      console.error("[materialize] Error creating campaign:", err);
    }
  }

  return created;
}
