import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  family: z.enum(["research", "production", "execution", "review"]),
  agentType: z.string().min(1),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  trigger: z.enum(["request", "event", "scheduled"]).default("request"),
  input: z.record(z.unknown()).optional(),
  reason: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
  parentTaskId: z.string().optional(),
});

export async function GET(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const family = searchParams.get("family");

  const tasks = await prisma.task.findMany({
    where: {
      workspaceId,
      ...(status ? { status: status as never } : {}),
      ...(family ? { family: family as never } : {}),
    },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    take: 50,
  });

  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const body = await request.json();
  const parsed = createTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Verify workspace exists
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: 404 }
    );
  }

  const task = await prisma.task.create({
    data: {
      workspaceId,
      title: data.title,
      description: data.description,
      family: data.family,
      agentType: data.agentType,
      priority: data.priority,
      trigger: data.trigger,
      input: data.input as never,
      reason: data.reason,
      scheduledFor: data.scheduledFor
        ? new Date(data.scheduledFor)
        : undefined,
      parentTaskId: data.parentTaskId,
      status: "queued",
    },
  });

  // Log event
  await prisma.event.create({
    data: {
      workspaceId,
      type: "task_created",
      data: {
        taskId: task.id,
        title: data.title,
        family: data.family,
        agentType: data.agentType,
        trigger: data.trigger,
        reason: data.reason,
      },
    },
  });

  return NextResponse.json(task, { status: 201 });
}
