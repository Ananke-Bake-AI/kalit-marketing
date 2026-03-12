import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET — Get the active growth plan for a workspace.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const plan = await prisma.growthPlan.findFirst({
    where: { workspaceId, isActive: true },
    orderBy: { version: "desc" },
  });

  if (!plan) {
    return NextResponse.json(
      { error: "No active growth plan" },
      { status: 404 }
    );
  }

  return NextResponse.json(plan);
}
