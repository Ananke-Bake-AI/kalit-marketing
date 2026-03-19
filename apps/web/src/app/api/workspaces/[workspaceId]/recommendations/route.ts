/**
 * Recommendations API
 *
 * GET — List recommendations for a workspace (optionally filter by status/campaign)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kalit/db";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  const { workspaceId } = await ctx.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status"); // pending, approved, dismissed, applied
  const campaignId = searchParams.get("campaignId");

  const where: Record<string, unknown> = { workspaceId };
  if (status) where.status = status;
  if (campaignId) where.campaignId = campaignId;

  const recommendations = await prisma.recommendation.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 50,
    include: {
      campaign: { select: { id: true, name: true, status: true } },
    },
  });

  return NextResponse.json({ recommendations });
}
