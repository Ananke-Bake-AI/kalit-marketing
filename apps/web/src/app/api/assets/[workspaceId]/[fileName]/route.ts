import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { resolveFilePath } from "@/lib/storage";

interface RouteContext {
  params: Promise<{ workspaceId: string; fileName: string }>;
}

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

/**
 * GET — Serve a stored workspace asset file.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { workspaceId, fileName } = await context.params;

  const storageKey = `assets/${workspaceId}/${fileName}`;
  const filePath = resolveFilePath(storageKey);

  try {
    const buffer = await readFile(filePath);
    const ext = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
