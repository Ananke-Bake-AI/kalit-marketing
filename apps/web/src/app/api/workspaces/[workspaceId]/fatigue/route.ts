import { NextRequest, NextResponse } from "next/server";
import {
  detectFatigue,
  rotateFatiguedCreatives,
} from "@/lib/engine/fatigue-detector";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET — Scan for creative fatigue.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const report = await detectFatigue(workspaceId);
  return NextResponse.json(report);
}

/**
 * POST — Rotate fatigued creatives.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const { creativeIds } = await request.json();

  if (!Array.isArray(creativeIds) || creativeIds.length === 0) {
    return NextResponse.json(
      { error: "No creative IDs provided" },
      { status: 400 }
    );
  }

  const rotated = await rotateFatiguedCreatives(workspaceId, creativeIds);

  return NextResponse.json({
    rotated,
    timestamp: new Date().toISOString(),
  });
}
