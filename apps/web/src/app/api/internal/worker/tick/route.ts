/**
 * Worker Tick — the autonomous loop heartbeat
 *
 * Single endpoint that runs the entire autonomous optimization cycle.
 * Called every hour by Vercel Cron (or manually for testing).
 *
 * Four phases per tick:
 *   0. Scheduler — create due tasks (performance reviews, budget checks, etc.)
 *   1. Sync performance data from ad platforms
 *   2. Pick up queued tasks and execute via agent router
 *   3. Parse completed task outputs → auto-apply safe actions / create recommendations
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@kalit/db";
import { runSchedulerTick } from "@/lib/engine/scheduler";
import { syncPerformanceData } from "@/lib/tracking/measurement";
import { processTask } from "@/lib/engine/agent-router";
import { applyActions } from "@/lib/engine/action-applicator";

const MAX_TASKS_PER_TICK = 5;

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Verify the request is from Vercel Cron or an authorized caller.
 * In dev, allow all requests.
 */
function isAuthorized(request: NextRequest): boolean {
  // Vercel Cron sends this header
  const cronSecret = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  // Dev mode or no secret configured — allow
  if (!expectedSecret || process.env.NODE_ENV === "development") return true;

  return cronSecret === `Bearer ${expectedSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const summary = {
    phase0_scheduler: { tasksCreated: 0, workspacesChecked: 0 },
    phase1_sync: { workspaces: 0, campaignsUpdated: 0, errors: [] as string[] },
    phase2_tasks: { processed: 0, succeeded: 0, failed: 0, errors: [] as string[] },
    phase3_actions: { applied: 0, recommendations: 0, errors: [] as string[] },
    durationMs: 0,
  };

  try {
    // ================================================================
    // PHASE 0: Run scheduler — create due tasks for active workspaces
    // ================================================================
    try {
      const schedulerResult = await runSchedulerTick();
      summary.phase0_scheduler.tasksCreated = schedulerResult.tasksCreated;
      summary.phase0_scheduler.workspacesChecked = schedulerResult.workspacesChecked;
      console.log(
        `[worker/tick] Phase 0: ${schedulerResult.tasksCreated} tasks created for ${schedulerResult.workspacesChecked} workspaces`
      );
    } catch (err) {
      console.error("[worker/tick] Phase 0 (scheduler) error:", err);
    }

    // ================================================================
    // PHASE 1: Sync performance data from all active workspaces
    // ================================================================
    const activeWorkspaces = await prisma.workspace.findMany({
      where: {
        status: { notIn: ["onboarding", "paused", "blocked"] },
        connectedAccounts: { some: { isActive: true } },
      },
      select: { id: true },
    });

    for (const ws of activeWorkspaces) {
      try {
        const result = await syncPerformanceData(ws.id);
        summary.phase1_sync.campaignsUpdated += result.campaignsUpdated;
        summary.phase1_sync.errors.push(...result.errors);
        summary.phase1_sync.workspaces++;
      } catch (err) {
        summary.phase1_sync.errors.push(
          `Workspace ${ws.id}: ${err instanceof Error ? err.message : "sync failed"}`
        );
      }
    }

    // ================================================================
    // PHASE 2: Pick up and process queued tasks
    // ================================================================
    const queuedTasks = await prisma.task.findMany({
      where: {
        status: { in: ["queued", "approved"] },
        OR: [
          { scheduledFor: null },
          { scheduledFor: { lte: new Date() } },
        ],
      },
      orderBy: [{ createdAt: "asc" }],
      take: MAX_TASKS_PER_TICK * 2,
      select: { id: true, priority: true, title: true, agentType: true },
    });

    const sorted = queuedTasks.sort(
      (a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
    );
    const toProcess = sorted.slice(0, MAX_TASKS_PER_TICK);

    for (const task of toProcess) {
      try {
        const result = await processTask(task.id);
        summary.phase2_tasks.processed++;
        if (result.success) {
          summary.phase2_tasks.succeeded++;
        } else {
          summary.phase2_tasks.failed++;
          summary.phase2_tasks.errors.push(`${task.title}: ${result.error}`);
        }
      } catch (err) {
        summary.phase2_tasks.failed++;
        summary.phase2_tasks.errors.push(
          `${task.title}: ${err instanceof Error ? err.message : "processing failed"}`
        );
      }
    }

    // ================================================================
    // PHASE 3: Apply completed task outputs
    // ================================================================
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const unappliedTasks = await prisma.task.findMany({
      where: {
        status: "completed",
        output: { not: Prisma.DbNull },
        completedAt: { gte: oneDayAgo },
        agentType: { in: ["budget_manager", "performance_analyst", "optimization_engine"] },
      },
      orderBy: { completedAt: "asc" },
      take: 10,
      select: {
        id: true,
        workspaceId: true,
        agentType: true,
        output: true,
      },
    });

    for (const task of unappliedTasks) {
      try {
        // Idempotency: skip if already processed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingRec = await (prisma as any).recommendation?.findFirst?.({
          where: { taskId: task.id },
          select: { id: true },
        }).catch(() => null);
        const existingEvent = await prisma.event.findFirst({
          where: {
            workspaceId: task.workspaceId,
            type: "agent_action_taken",
            data: { path: ["taskId"], equals: task.id },
          },
          select: { id: true },
        });
        if (existingRec || existingEvent) continue;

        const output = task.output as Record<string, unknown>;
        const result = await applyActions(
          task.workspaceId,
          task.id,
          task.agentType,
          output,
        );

        summary.phase3_actions.applied += result.autoApplied;
        summary.phase3_actions.recommendations += result.recommendationsCreated;
        summary.phase3_actions.errors.push(...result.errors);
      } catch (err) {
        summary.phase3_actions.errors.push(
          `Task ${task.id}: ${err instanceof Error ? err.message : "apply failed"}`
        );
      }
    }
  } catch (err) {
    console.error("[worker/tick] Fatal error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Worker tick failed", summary },
      { status: 500 }
    );
  }

  summary.durationMs = Date.now() - startTime;

  console.log(
    `[worker/tick] Complete in ${summary.durationMs}ms — ` +
    `scheduler: ${summary.phase0_scheduler.tasksCreated} tasks, ` +
    `sync: ${summary.phase1_sync.workspaces} workspaces, ` +
    `processed: ${summary.phase2_tasks.processed} tasks, ` +
    `actions: ${summary.phase3_actions.applied} auto-applied + ${summary.phase3_actions.recommendations} recommendations`
  );

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...summary,
  });
}
