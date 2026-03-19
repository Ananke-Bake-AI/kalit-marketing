/**
 * Single Recommendation API
 *
 * PATCH — Approve or dismiss a recommendation
 *   Body: { action: "approve" | "dismiss" }
 *   On approve: executes the action payload against the ad platform
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kalit/db";
import { executeRecommendation } from "@/lib/engine/action-applicator";

interface RouteContext {
  params: Promise<{ workspaceId: string; recommendationId: string }>;
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const { workspaceId, recommendationId } = await ctx.params;

  const rec = await prisma.recommendation.findUnique({
    where: { id: recommendationId },
  });

  if (!rec || rec.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
  }

  if (rec.status !== "pending") {
    return NextResponse.json(
      { error: `Recommendation already ${rec.status}` },
      { status: 400 }
    );
  }

  const body = await request.json();
  const action = body.action as string;

  if (action === "approve") {
    // Mark as approved, then execute
    await prisma.recommendation.update({
      where: { id: recommendationId },
      data: { status: "approved" },
    });

    const result = await executeRecommendation(recommendationId);

    return NextResponse.json({
      success: result.success,
      recommendation: await prisma.recommendation.findUnique({
        where: { id: recommendationId },
      }),
      error: result.error,
    });
  }

  if (action === "dismiss") {
    const updated = await prisma.recommendation.update({
      where: { id: recommendationId },
      data: {
        status: "dismissed",
        resolvedAt: new Date(),
      },
    });

    await prisma.event.create({
      data: {
        workspaceId,
        type: "agent_action_taken",
        data: {
          recommendationId,
          category: rec.category,
          title: rec.title,
        },
      },
    });

    return NextResponse.json({ success: true, recommendation: updated });
  }

  return NextResponse.json(
    { error: "Invalid action. Use: approve, dismiss" },
    { status: 400 }
  );
}
