import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";
import { storeFile } from "@/lib/storage";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET — List all assets for a workspace. Supports ?category= and ?search= filters.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");

  const assets = await prisma.workspaceAsset.findMany({
    where: {
      workspaceId,
      ...(category ? { category: category as never } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { tags: { hasSome: [search] } },
            ],
          }
        : {}),
    },
    orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json(assets);
}

/**
 * POST — Upload one or more files as workspace assets.
 * Accepts multipart/form-data with:
 *   - files: File[] (required)
 *   - category: string (optional, default "raw_asset")
 *   - usageNotes: string (optional)
 *   - tags: string (optional, comma-separated)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  // Verify workspace exists
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];
  const category = (formData.get("category") as string) || "raw_asset";
  const usageNotes = formData.get("usageNotes") as string | null;
  const tagsRaw = formData.get("tags") as string | null;
  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

  if (!files.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  // Max 20 files per request, 50MB per file
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  if (files.length > 20) {
    return NextResponse.json({ error: "Max 20 files per upload" }, { status: 400 });
  }

  const created = [];

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File "${file.name}" exceeds 50MB limit` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeFile(workspaceId, buffer, file.name, file.type);

    // Extract image dimensions if possible
    let width: number | undefined;
    let height: number | undefined;

    if (file.type.startsWith("image/")) {
      // Try to read dimensions from PNG/JPEG headers
      const dims = extractImageDimensions(buffer, file.type);
      if (dims) {
        width = dims.width;
        height = dims.height;
      }
    }

    // Build display name from filename
    const displayName = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const asset = await prisma.workspaceAsset.create({
      data: {
        workspaceId,
        category: category as never,
        fileName: stored.fileName,
        fileSize: stored.fileSize,
        mimeType: stored.mimeType,
        url: stored.url,
        name: displayName,
        tags,
        usageNotes,
        width: width ?? null,
        height: height ?? null,
        storageProvider: "local",
        storageKey: stored.storageKey,
      },
    });

    created.push(asset);
  }

  return NextResponse.json(created, { status: 201 });
}

/**
 * Lightweight image dimension extraction from PNG/JPEG headers.
 */
function extractImageDimensions(
  buffer: Buffer,
  mimeType: string
): { width: number; height: number } | null {
  try {
    // PNG: width at bytes 16-19, height at 20-23
    if (mimeType === "image/png" && buffer.length >= 24) {
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
      };
    }

    // JPEG: scan for SOF markers (0xFF 0xC0..0xCF except 0xC4 and 0xC8)
    if ((mimeType === "image/jpeg" || mimeType === "image/jpg") && buffer.length > 2) {
      let offset = 2;
      while (offset < buffer.length - 9) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        if (
          marker >= 0xc0 &&
          marker <= 0xcf &&
          marker !== 0xc4 &&
          marker !== 0xc8
        ) {
          return {
            height: buffer.readUInt16BE(offset + 5),
            width: buffer.readUInt16BE(offset + 7),
          };
        }
        const segLen = buffer.readUInt16BE(offset + 2);
        offset += 2 + segLen;
      }
    }

    return null;
  } catch {
    return null;
  }
}
