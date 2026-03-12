import { NextRequest, NextResponse } from "next/server";
import { generateReport } from "@/lib/reporting/generate";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET — Generate a growth report for the workspace.
 * Query params: ?start=YYYY-MM-DD&end=YYYY-MM-DD (defaults to last 7 days)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;
  const { searchParams } = new URL(request.url);

  const endDate = searchParams.get("end")
    ? new Date(searchParams.get("end")!)
    : new Date();

  const startDate = searchParams.get("start")
    ? new Date(searchParams.get("start")!)
    : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  const report = await generateReport(workspaceId, startDate, endDate);

  return NextResponse.json(report);
}
