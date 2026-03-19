import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const body = await req.json();

  // Validate workspace exists
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Update config (only provided fields)
  const config = await prisma.workspaceConfig.update({
    where: { workspaceId },
    data: {
      ...(body.monthlyBudget !== undefined
        ? { monthlyBudget: body.monthlyBudget }
        : {}),
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
      ...(body.primaryGoal !== undefined
        ? { primaryGoal: body.primaryGoal }
        : {}),
      ...(body.targetCac !== undefined ? { targetCac: body.targetCac } : {}),
      ...(body.targetRoas !== undefined
        ? { targetRoas: body.targetRoas }
        : {}),
      ...(body.productName !== undefined
        ? { productName: body.productName }
        : {}),
      ...(body.productDescription !== undefined
        ? { productDescription: body.productDescription }
        : {}),
      ...(body.icpDescription !== undefined
        ? { icpDescription: body.icpDescription }
        : {}),
      ...(body.brandVoice !== undefined
        ? { brandVoice: body.brandVoice }
        : {}),
      ...(body.autonomyMode !== undefined
        ? { autonomyMode: body.autonomyMode }
        : {}),
      ...(body.targetGeographies !== undefined
        ? { targetGeographies: body.targetGeographies }
        : {}),
    },
  });

  return NextResponse.json(config);
}
