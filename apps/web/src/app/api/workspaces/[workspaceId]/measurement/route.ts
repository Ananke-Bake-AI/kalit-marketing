import { NextRequest, NextResponse } from "next/server";
import { computeMeasurementConfidence } from "@/lib/tracking/measurement";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET — Get measurement confidence score for the workspace.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const confidence = await computeMeasurementConfidence(workspaceId);

  return NextResponse.json(confidence);
}
