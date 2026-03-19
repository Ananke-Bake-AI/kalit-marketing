import { NextRequest, NextResponse } from "next/server";
import {
  optimizeBudget,
  applyReallocations,
} from "@/lib/engine/budget-optimizer";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET — Analyze budget and return proposed reallocations.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const result = await optimizeBudget(workspaceId);
  return NextResponse.json(result);
}

/**
 * POST — Apply budget reallocations.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const { reallocations } = await request.json();

  if (!Array.isArray(reallocations) || reallocations.length === 0) {
    return NextResponse.json(
      { error: "No reallocations provided" },
      { status: 400 }
    );
  }

  await applyReallocations(workspaceId, reallocations);

  return NextResponse.json({
    applied: reallocations.length,
    timestamp: new Date().toISOString(),
  });
}
