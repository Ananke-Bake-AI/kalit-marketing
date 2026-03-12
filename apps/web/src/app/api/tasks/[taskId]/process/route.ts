import { NextRequest, NextResponse } from "next/server";
import { processTask } from "@/lib/engine/agent-router";

interface RouteContext {
  params: Promise<{ taskId: string }>;
}

/**
 * POST /api/tasks/:taskId/process — Execute a queued task.
 * Routes the task to the appropriate specialist agent.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  const { taskId } = await context.params;

  const result = await processTask(taskId);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ output: result.output });
}
