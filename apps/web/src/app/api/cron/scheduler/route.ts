import { NextResponse } from "next/server";
import { runSchedulerTick } from "@/lib/engine/scheduler";

/**
 * GET /api/cron/scheduler — Run the scheduler tick.
 * In production, this would be called by a cron job (e.g., Vercel Cron).
 */
export async function GET() {
  const result = await runSchedulerTick();

  return NextResponse.json({
    ...result,
    timestamp: new Date().toISOString(),
  });
}
