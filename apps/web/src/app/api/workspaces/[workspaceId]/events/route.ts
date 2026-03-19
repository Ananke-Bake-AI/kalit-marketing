import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

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
