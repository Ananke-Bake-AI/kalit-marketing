import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;
  const { searchParams } = new URL(request.url);

  const type = searchParams.get("type");
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const events = await prisma.event.findMany({
    where: {
      workspaceId,
      ...(type ? { type: type as never } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });

  return NextResponse.json(events);
}
