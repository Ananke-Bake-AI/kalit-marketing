import { NextRequest, NextResponse } from "next/server";
import {
  createExperiment,
  evaluateExperiment,
  listExperiments,
} from "@/lib/engine/experiment-manager";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET — List experiments or evaluate a specific one.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;
  const { searchParams } = new URL(request.url);
  const experimentId = searchParams.get("id");

  if (experimentId) {
    const result = await evaluateExperiment(experimentId);
    return NextResponse.json(result);
  }

  const experiments = await listExperiments(workspaceId);
  return NextResponse.json(experiments);
}

/**
 * POST — Create a new experiment.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;
  const body = await request.json();

  const experiment = await createExperiment(workspaceId, {
    name: body.name,
    hypothesis: body.hypothesis,
    successMetric: body.successMetric || "conversion_rate",
    testDesign: body.testDesign,
    targetConfidence: body.targetConfidence,
    campaignIds: body.campaignIds,
  });

  return NextResponse.json(experiment, { status: 201 });
}
