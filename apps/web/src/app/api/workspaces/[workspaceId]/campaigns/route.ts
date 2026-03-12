import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const type = searchParams.get("type");

  const campaigns = await prisma.campaign.findMany({
    where: {
      workspaceId,
      ...(status ? { status: status as never } : {}),
      ...(type ? { type: type as never } : {}),
    },
    include: {
      adGroups: {
        include: {
          creatives: { include: { creative: true } },
          audience: true,
        },
      },
      experiment: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(campaigns);
}
