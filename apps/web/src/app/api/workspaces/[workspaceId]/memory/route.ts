import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET — Get workspace learning memories.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const { searchParams } = new URL(request.url);

  const type = searchParams.get("type");

  const memories = await prisma.memory.findMany({
    where: {
      workspaceId,
      ...(type ? { type: type as never } : {}),
    },
    orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });

  return NextResponse.json(memories);
}
