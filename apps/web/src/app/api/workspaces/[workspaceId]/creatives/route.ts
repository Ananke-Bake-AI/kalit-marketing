import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET — List creatives for a workspace.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const type = searchParams.get("type");

  const creatives = await prisma.creative.findMany({
    where: {
      workspaceId,
      ...(status ? { status: status as never } : {}),
      ...(type ? { type: type as never } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return NextResponse.json(creatives);
}
