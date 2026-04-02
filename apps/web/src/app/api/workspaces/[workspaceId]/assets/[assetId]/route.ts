import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";
import { deleteFile } from "@/lib/storage";

interface RouteContext {
  params: Promise<{ workspaceId: string; assetId: string }>;
}

/**
 * GET — Get a single asset by ID.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { workspaceId, assetId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const asset = await prisma.workspaceAsset.findFirst({
    where: { id: assetId, workspaceId },
  });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  return NextResponse.json(asset);
}

/**
 * PATCH — Update asset metadata (name, description, category, tags, usageNotes, isPrimary).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { workspaceId, assetId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const asset = await prisma.workspaceAsset.findFirst({
    where: { id: assetId, workspaceId },
  });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const body = await request.json();
  const allowedFields = ["name", "description", "category", "tags", "usageNotes", "isPrimary"];
  const data: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in body) {
      data[field] = body[field];
    }
  }

  // If marking as primary, unset other primaries in same category
  if (data.isPrimary === true) {
    const targetCategory = data.category ?? asset.category;
    await prisma.workspaceAsset.updateMany({
      where: {
        workspaceId,
        category: targetCategory as never,
        isPrimary: true,
        id: { not: assetId },
      },
      data: { isPrimary: false },
    });
  }

  const updated = await prisma.workspaceAsset.update({
    where: { id: assetId },
    data,
  });

  return NextResponse.json(updated);
}

/**
 * DELETE — Remove an asset and its stored file.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { workspaceId, assetId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const asset = await prisma.workspaceAsset.findFirst({
    where: { id: assetId, workspaceId },
  });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  // Delete the physical file
  await deleteFile(asset.storageKey);

  // Delete the DB record
  await prisma.workspaceAsset.delete({
    where: { id: assetId },
  });

  return NextResponse.json({ deleted: true });
}
