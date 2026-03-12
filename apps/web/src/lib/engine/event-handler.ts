/**
 * Event Handler
 *
 * Processes growth events and triggers appropriate responses.
 * This is the event-driven trigger mode — reacts to performance signals,
 * anomalies, and system events.
 */

import { prisma } from "@kalit/db";
import { transitionWorkspace } from "./lifecycle";

export interface EventPayload {
  workspaceId: string;
  type: string;
  data?: Record<string, unknown>;
}

/**
 * Process an incoming growth event and trigger appropriate actions.
 */
export async function handleEvent(event: EventPayload): Promise<{
  handled: boolean;
  actions: string[];
}> {
  const actions: string[] = [];

  switch (event.type) {
    // Performance anomaly — CPA spike, conversion drop, etc.
    case "performance_anomaly": {
      const workspace = await prisma.workspace.findUnique({
        where: { id: event.workspaceId },
      });
      if (
        workspace &&
        ["monitoring", "optimizing", "scaling"].includes(workspace.status)
      ) {
        await transitionWorkspace(
          event.workspaceId,
          "anomaly_detected",
          "anomaly",
          `Performance anomaly detected: ${event.data?.description || "unknown"}`
        );
        actions.push("transitioned_to_anomaly_detected");
      }
      break;
    }

    // Creative fatigue detected
    case "creative_fatigue_detected": {
      await prisma.task.create({
        data: {
          workspaceId: event.workspaceId,
          title: "Replace fatigued creatives",
          description: `Creative fatigue detected. Affected assets: ${event.data?.assetIds || "unknown"}`,
          family: "production",
          agentType: "creative_writer",
          priority: "high",
          trigger: "event",
          status: "queued",
          reason: "Creative fatigue score exceeded threshold",
        },
      });
      actions.push("created_creative_refresh_task");
      break;
    }

    // Budget threshold reached
    case "budget_threshold_reached": {
      await prisma.task.create({
        data: {
          workspaceId: event.workspaceId,
          title: "Review budget allocation",
          description: `Budget threshold reached: ${event.data?.threshold || "unknown"}. Review and reallocate.`,
          family: "review",
          agentType: "budget_manager",
          priority: "critical",
          trigger: "event",
          status: "queued",
          reason: `Budget threshold: ${event.data?.threshold}`,
        },
      });
      actions.push("created_budget_review_task");
      break;
    }

    // Tracking broken
    case "tracking_broken": {
      await prisma.task.create({
        data: {
          workspaceId: event.workspaceId,
          title: "Fix broken tracking",
          description: `Tracking issue detected: ${event.data?.issue || "unknown"}`,
          family: "review",
          agentType: "tracking_auditor",
          priority: "critical",
          trigger: "event",
          status: "queued",
          reason: "Tracking health check failed",
        },
      });
      actions.push("created_tracking_fix_task");
      break;
    }

    // Conversion drop
    case "conversion_drop_detected": {
      await prisma.task.create({
        data: {
          workspaceId: event.workspaceId,
          title: "Investigate conversion drop",
          description: `Conversion rate dropped ${event.data?.dropPercent || "significantly"}%. Investigate root cause.`,
          family: "review",
          agentType: "performance_analyst",
          priority: "critical",
          trigger: "event",
          status: "queued",
          reason: `Conversion drop: ${event.data?.dropPercent}%`,
        },
      });
      actions.push("created_conversion_investigation_task");
      break;
    }

    // Competitor signal
    case "competitor_signal": {
      await prisma.task.create({
        data: {
          workspaceId: event.workspaceId,
          title: "Analyze competitor change",
          description: `Competitor signal: ${event.data?.signal || "new activity detected"}`,
          family: "research",
          agentType: "competitor_analyst",
          priority: "medium",
          trigger: "event",
          status: "queued",
          reason: `Competitor signal detected`,
        },
      });
      actions.push("created_competitor_analysis_task");
      break;
    }

    // SEO ranking change
    case "seo_ranking_changed": {
      await prisma.task.create({
        data: {
          workspaceId: event.workspaceId,
          title: "Review SEO ranking changes",
          description: `Rankings changed: ${event.data?.summary || "check Search Console"}`,
          family: "research",
          agentType: "seo_researcher",
          priority: "medium",
          trigger: "event",
          status: "queued",
          reason: "SEO ranking shift detected",
        },
      });
      actions.push("created_seo_review_task");
      break;
    }

    // Platform policy rejection
    case "platform_policy_rejection": {
      await prisma.task.create({
        data: {
          workspaceId: event.workspaceId,
          title: "Handle ad policy rejection",
          description: `Ad rejected by ${event.data?.platform || "platform"}: ${event.data?.reason || "unknown"}`,
          family: "review",
          agentType: "compliance_checker",
          priority: "high",
          trigger: "event",
          status: "queued",
          reason: `Policy rejection on ${event.data?.platform}`,
        },
      });
      actions.push("created_compliance_review_task");
      break;
    }
  }

  // Always log the event
  await prisma.event.create({
    data: {
      workspaceId: event.workspaceId,
      type: event.type as never,
      data: event.data as never,
    },
  });

  return { handled: actions.length > 0, actions };
}
