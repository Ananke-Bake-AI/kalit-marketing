import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET — Check supervisor status for a workspace.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const config = await prisma.workspaceConfig.findUnique({
    where: { workspaceId },
    select: {
      supervisorEnabled: true,
      scheduleMode: true,
      customIntervals: true,
      lastSupervisorRun: true,
      supervisorStatus: true,
    },
  });

  if (!config) {
    return NextResponse.json({ error: "Workspace config not found" }, { status: 404 });
  }

  return NextResponse.json(config);
}

/**
 * POST — Start, pause, or configure the supervisor for a workspace.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action as string;

  if (!["start", "pause", "configure"].includes(action)) {
    return NextResponse.json(
      { error: "Action must be 'start', 'pause', or 'configure'" },
      { status: 400 }
    );
  }

  try {
    if (action === "start") {
      const mode = (body.mode as string) ?? "automatic";
      const customInterval = body.intervalMinutes as number | undefined;

      const { registerWorkspaceSupervisor } = await import("@/lib/queue/workers/supervisor-worker");
      await registerWorkspaceSupervisor(
        workspaceId,
        mode as "automatic" | "custom",
        customInterval
      );

      return NextResponse.json({
        status: "running",
        mode,
        message: `Supervisor started in ${mode} mode`,
      });
    }

    if (action === "pause") {
      const { pauseWorkspaceSupervisor } = await import("@/lib/queue/workers/supervisor-worker");
      await pauseWorkspaceSupervisor(workspaceId);

      return NextResponse.json({
        status: "paused",
        message: "Supervisor paused",
      });
    }

    if (action === "configure") {
      const customIntervals = body.customIntervals as Record<string, number> | undefined;
      const mode = (body.mode as string) ?? "automatic";

      await prisma.workspaceConfig.update({
        where: { workspaceId },
        data: {
          scheduleMode: mode,
          customIntervals: customIntervals ?? undefined,
        },
      });

      // If supervisor is running, restart with new config
      const config = await prisma.workspaceConfig.findUnique({
        where: { workspaceId },
        select: { supervisorEnabled: true },
      });

      if (config?.supervisorEnabled) {
        const { registerWorkspaceSupervisor } = await import("@/lib/queue/workers/supervisor-worker");
        await registerWorkspaceSupervisor(
          workspaceId,
          mode as "automatic" | "custom"
        );
      }

      return NextResponse.json({
        status: "configured",
        mode,
        customIntervals,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Supervisor action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
