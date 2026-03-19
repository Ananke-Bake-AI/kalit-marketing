/**
 * Connection Account Config API
 *
 * GET  /api/workspaces/:workspaceId/connections/:platform/config
 * PATCH /api/workspaces/:workspaceId/connections/:platform/config
 *
 * Reads / updates metadata on a connected account (e.g., Google Ads Customer ID).
 */

import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { getPlatformKey } from "@/lib/platform-keys";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

type Platform = "meta" | "google" | "tiktok" | "linkedin" | "x" | "reddit" | "hubspot";

interface RouteContext {
  params: Promise<{ workspaceId: string; platform: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { workspaceId, platform } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const account = await prisma.connectedAccount.findFirst({
    where: {
      workspaceId,
      platform: platform as Platform,
      isActive: true,
    },
  });

  if (!account) {
    return NextResponse.json(
      { error: `No active ${platform} account found`, metadata: {} },
      { status: 404 }
    );
  }

  return NextResponse.json({
    metadata: (account.metadata as Record<string, unknown>) ?? {},
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { workspaceId, platform } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Find the connected account
  const account = await prisma.connectedAccount.findFirst({
    where: {
      workspaceId,
      platform: platform as Platform,
      isActive: true,
    },
  });

  if (!account) {
    return NextResponse.json(
      { error: `No active ${platform} account found for this workspace` },
      { status: 404 }
    );
  }

  // Merge new metadata with existing
  const existingMetadata = (account.metadata as Record<string, unknown>) ?? {};
  const updatedMetadata = { ...existingMetadata, ...body };

  // If customerId is provided, also update accountId (Google Ads uses this)
  const updateData: Record<string, unknown> = {
    metadata: updatedMetadata,
  };

  // For Google: save Customer ID as accountId so the adapter can use it
  if (platform === "google" && body.customerId) {
    const customerId = String(body.customerId).replace(/-/g, "");
    updateData.accountId = customerId;
    (updatedMetadata as Record<string, unknown>).customerId = body.customerId;
    (updatedMetadata as Record<string, unknown>).googleUserId = account.accountId;

    // Also inject developer token from platform keys
    const devToken = getPlatformKey("GOOGLE_ADS_DEVELOPER_TOKEN");
    if (devToken) {
      (updatedMetadata as Record<string, unknown>).developerToken = devToken;
    }

    updateData.metadata = updatedMetadata;
  }

  await prisma.connectedAccount.update({
    where: { id: account.id },
    data: updateData,
  });

  return NextResponse.json({ success: true, metadata: updatedMetadata });
}
