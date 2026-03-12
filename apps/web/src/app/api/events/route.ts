import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleEvent } from "@/lib/engine/event-handler";

const eventSchema = z.object({
  workspaceId: z.string().min(1),
  type: z.string().min(1),
  data: z.record(z.unknown()).optional(),
});

/**
 * POST /api/events — Ingest a growth event.
 * The event handler will process it and trigger appropriate tasks.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = eventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await handleEvent({
    workspaceId: parsed.data.workspaceId,
    type: parsed.data.type,
    data: parsed.data.data as Record<string, unknown> | undefined,
  });

  return NextResponse.json(result);
}
