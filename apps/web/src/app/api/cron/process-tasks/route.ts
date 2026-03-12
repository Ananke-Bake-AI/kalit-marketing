/**
 * Task Execution Worker
 *
 * Cron endpoint that picks up queued/approved tasks and processes them
 * through the agent router. Takes up to 5 tasks per tick to avoid timeout.
 *
 * GET /api/cron/process-tasks
 */

import { prisma } from "@kalit/db";
import { NextResponse } from "next/server";
import { processTask } from "@/lib/engine/agent-router";

const MAX_TASKS_PER_TICK = 5;

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function isApiKeyValid(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!key && key !== "sk-ant-xxx" && !key.startsWith("sk-ant-xxx");
}

function generateMockOutput(agentType: string, title: string): Record<string, unknown> {
  return {
    _mock: true,
    _agentType: agentType,
    _model: "mock",
    _tokensUsed: 0,
    summary: `Mock output for "${title}" — API key not configured.`,
    recommendations: [
      {
        action: "Configure ANTHROPIC_API_KEY to enable real agent execution",
        reason: "Running in dev/mock mode",
        impact: "high",
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  const summary = { processed: 0, succeeded: 0, failed: 0, skipped: 0 };

  try {
    // Find tasks ready for processing, ordered by priority then age
    const tasks = await prisma.task.findMany({
      where: {
        status: { in: ["queued", "approved"] },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      take: MAX_TASKS_PER_TICK,
    });

    // Sort by our custom priority order (Prisma enum ordering may differ)
    tasks.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 99;
      const pb = PRIORITY_ORDER[b.priority] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const useRealApi = isApiKeyValid();

    for (const task of tasks) {
      summary.processed++;

      try {
        if (!useRealApi) {
          // Mock mode: skip actual API call, generate placeholder output
          const mockOutput = generateMockOutput(task.agentType, task.title);

          const completionStatus =
            task.family === "production" ? "waiting_approval" : "completed";

          await prisma.task.update({
            where: { id: task.id },
            data: {
              status: completionStatus,
              startedAt: new Date(),
              completedAt: new Date(),
              output: mockOutput as never,
            },
          });

          await prisma.event.create({
            data: {
              workspaceId: task.workspaceId,
              type: "task_completed",
              data: {
                taskId: task.id,
                title: task.title,
                agentType: task.agentType,
                status: completionStatus,
                mock: true,
              },
            },
          });

          summary.succeeded++;
          continue;
        }

        // Real mode: update status to executing, then call agent router
        await prisma.task.update({
          where: { id: task.id },
          data: { status: "executing", startedAt: new Date() },
        });

        const result = await processTask(task.id);

        if (result.success) {
          summary.succeeded++;
        } else {
          summary.failed++;
        }
      } catch (error) {
        summary.failed++;
        const message =
          error instanceof Error ? error.message : "Unknown error";

        await prisma.task.update({
          where: { id: task.id },
          data: {
            status: "failed",
            output: { error: message } as never,
            completedAt: new Date(),
            retryCount: { increment: 1 },
          },
        });

        await prisma.event.create({
          data: {
            workspaceId: task.workspaceId,
            type: "task_failed",
            data: { taskId: task.id, error: message },
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      ...summary,
      mockMode: !useRealApi,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message, ...summary },
      { status: 500 }
    );
  }
}
