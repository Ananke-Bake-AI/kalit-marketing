import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      config: true,
      connectedAccounts: true,
      _count: {
        select: {
          campaigns: true,
          tasks: true,
          creatives: true,
          experiments: true,
          memories: true,
        },
      },
    },
  });

  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(workspace);
}
