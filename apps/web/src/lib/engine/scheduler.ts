/**
 * Growth Scheduler
 *
 * Manages scheduled tasks for each workspace.
 * Three trigger modes: request-driven, event-driven, scheduled (cron).
 *
 * In production this would be a separate worker process.
 * For MVP, we expose functions that can be called from API routes or cron endpoints.
 */

import { prisma } from "@kalit/db";

export interface ScheduleDefinition {
  name: string;
  description: string;
  intervalHours: number;
  family: "research" | "production" | "execution" | "review";
  agentType: string;
  priority: "critical" | "high" | "medium" | "low";
  /** Only run for workspaces in these lifecycle states */
  activeStates: string[];
}

/**
 * Default scheduled jobs that run for every active workspace.
 */
export const scheduledJobs: ScheduleDefinition[] = [
  {
    name: "Daily performance review",
    description: "Analyze campaign performance, spend, conversions, and attribution quality across all active campaigns.",
    intervalHours: 24,
    family: "review",
    agentType: "performance_analyst",
    priority: "high",
    activeStates: ["monitoring", "optimizing", "scaling"],
  },
  {
    name: "Creative fatigue check",
    description: "Detect creative fatigue across active ads and flag assets needing refresh.",
    intervalHours: 48,
    family: "review",
    agentType: "performance_analyst",
    priority: "medium",
    activeStates: ["monitoring", "optimizing", "scaling"],
  },
  {
    name: "Competitor scan",
    description: "Scan competitor ads library, landing pages, and content for new patterns.",
    intervalHours: 72,
    family: "research",
    agentType: "competitor_analyst",
    priority: "medium",
    activeStates: ["monitoring", "optimizing", "scaling", "strategy_ready"],
  },
  {
    name: "SEO opportunity scan",
    description: "Analyze keyword rankings, search trends, and content gaps.",
    intervalHours: 168, // weekly
    family: "research",
    agentType: "seo_researcher",
    priority: "low",
    activeStates: ["monitoring", "optimizing", "scaling"],
  },
  {
    name: "Weekly strategy refresh",
    description: "Review growth strategy effectiveness and recommend adjustments to channel mix, budget allocation, and messaging.",
    intervalHours: 168,
    family: "review",
    agentType: "strategy_advisor",
    priority: "high",
    activeStates: ["monitoring", "optimizing", "scaling"],
  },
  {
    name: "Tracking health check",
    description: "Verify pixel health, conversion event firing, and attribution consistency.",
    intervalHours: 24,
    family: "review",
    agentType: "tracking_auditor",
    priority: "high",
    activeStates: ["launching", "monitoring", "optimizing", "scaling"],
  },
  {
    name: "Trend and topic scan",
    description: "Scan social trends, news, and industry topics for content opportunities.",
    intervalHours: 24,
    family: "research",
    agentType: "trend_scanner",
    priority: "low",
    activeStates: ["monitoring", "optimizing", "scaling"],
  },
];

/**
 * Run the scheduler tick — checks all workspaces and creates due tasks.
 * Called by a cron endpoint (e.g., /api/cron/scheduler).
 */
export async function runSchedulerTick(): Promise<{
  workspacesChecked: number;
  tasksCreated: number;
}> {
  let tasksCreated = 0;

  // Get all active workspaces (not paused or blocked)
  const workspaces = await prisma.workspace.findMany({
    where: {
      status: {
        notIn: ["paused", "blocked", "onboarding"],
      },
    },
  });

  for (const workspace of workspaces) {
    for (const job of scheduledJobs) {
      // Only run for workspaces in the right state
      if (!job.activeStates.includes(workspace.status)) continue;

      // Check if this job was already run recently
      const lastRun = await prisma.task.findFirst({
        where: {
          workspaceId: workspace.id,
          agentType: job.agentType,
          trigger: "scheduled",
          title: job.name,
          createdAt: {
            gte: new Date(Date.now() - job.intervalHours * 60 * 60 * 1000),
          },
        },
        orderBy: { createdAt: "desc" },
      });

      if (lastRun) continue; // Not due yet

      // Create the scheduled task
      await prisma.task.create({
        data: {
          workspaceId: workspace.id,
          title: job.name,
          description: job.description,
          family: job.family,
          agentType: job.agentType,
          priority: job.priority,
          trigger: "scheduled",
          status: "queued",
          reason: `Scheduled job (every ${job.intervalHours}h)`,
        },
      });

      await prisma.event.create({
        data: {
          workspaceId: workspace.id,
          type: "task_created",
          data: {
            title: job.name,
            family: job.family,
            agentType: job.agentType,
            trigger: "scheduled",
            intervalHours: job.intervalHours,
          },
        },
      });

      tasksCreated++;
    }
  }

  return { workspacesChecked: workspaces.length, tasksCreated };
}
