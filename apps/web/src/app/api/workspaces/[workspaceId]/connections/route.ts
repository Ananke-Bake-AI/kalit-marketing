import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET — List connected accounts for a workspace.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const accounts = await prisma.connectedAccount.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      platform: true,
      accountName: true,
      isActive: true,
      lastSyncAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json(accounts);
}

/**
 * POST — Connect a new platform via API key.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const platform = body.platform as string;
  const apiKey = body.apiKey as string;

  if (!platform || !apiKey) {
    return NextResponse.json(
      { error: "Platform and apiKey are required" },
      { status: 400 }
    );
  }

  // Check if already connected
  const existing = await prisma.connectedAccount.findFirst({
    where: { workspaceId, platform: platform as never },
  });

  if (existing) {
    // Update credentials
    await prisma.connectedAccount.update({
      where: { id: existing.id },
      data: {
        credentials: { apiKey } as never,
        isActive: true,
      },
    });

    return NextResponse.json({ id: existing.id, updated: true });
  }

  // Create new connection
  const account = await prisma.connectedAccount.create({
    data: {
      workspaceId,
      platform: platform as never,
      accountId: `apikey_${Date.now()}`,
      accountName: `${platform} (API key)`,
      credentials: { apiKey } as never,
      isActive: true,
    },
  });

  return NextResponse.json({ id: account.id, created: true });
}
