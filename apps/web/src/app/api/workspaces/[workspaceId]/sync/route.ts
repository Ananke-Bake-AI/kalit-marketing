import { NextRequest, NextResponse } from "next/server";
import { syncPerformanceData } from "@/lib/tracking/measurement";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * POST — Trigger performance data sync from connected ad platforms.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const result = await syncPerformanceData(workspaceId);

  return NextResponse.json({
    ...result,
    timestamp: new Date().toISOString(),
  });
}
