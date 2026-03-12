import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { transitionWorkspace } from "@/lib/engine/lifecycle";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

const transitionSchema = z.object({
  to: z.string().min(1),
  trigger: z.string().min(1),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;
  const body = await request.json();
  const parsed = transitionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await transitionWorkspace(
    workspaceId,
    parsed.data.to as never,
    parsed.data.trigger,
    parsed.data.reason
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    workspace: result.workspace,
    tasksCreated: result.tasksCreated,
  });
}
