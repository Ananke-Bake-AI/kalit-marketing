import { NextRequest, NextResponse } from "next/server";
import { computeMeasurementConfidence } from "@/lib/tracking/measurement";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET — Get measurement confidence score for the workspace.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const confidence = await computeMeasurementConfidence(workspaceId);

  return NextResponse.json(confidence);
}
