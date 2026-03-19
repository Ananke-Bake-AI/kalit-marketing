import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

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

/**
 * PATCH — Update workspace name and/or config fields.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Update workspace-level fields
  const workspaceUpdate: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    workspaceUpdate.name = body.name.trim();
  }

  if (Object.keys(workspaceUpdate).length > 0) {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: workspaceUpdate,
    });
  }

  // Update config-level fields
  const configFields = [
    "productName",
    "productDescription",
    "productUrl",
    "industry",
    "stage",
    "icpDescription",
    "brandVoice",
    "monthlyBudget",
    "targetCac",
    "targetRoas",
    "currency",
    "autonomyMode",
    "targetGeographies",
    "primaryGoal",
  ];

  const configUpdate: Record<string, unknown> = {};
  for (const field of configFields) {
    if (body[field] !== undefined) {
      configUpdate[field] = body[field];
    }
  }

  if (Object.keys(configUpdate).length > 0) {
    await prisma.workspaceConfig.update({
      where: { workspaceId },
      data: configUpdate,
    });
  }

  // Return updated workspace
  const updated = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { config: true },
  });

  return NextResponse.json(updated);
}
