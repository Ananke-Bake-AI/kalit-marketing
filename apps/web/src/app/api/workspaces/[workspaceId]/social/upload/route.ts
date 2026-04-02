import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";
import { storeFile } from "@/lib/storage";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * POST — Upload images for social content generation.
 * Returns stored URLs that can be passed to the generate endpoint.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;
  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (!files.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const MAX_SIZE = 20 * 1024 * 1024; // 20MB
  const urls: string[] = [];

  for (const file of files.slice(0, 5)) {
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `File "${file.name}" exceeds 20MB` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeFile(workspaceId, buffer, file.name, file.type);
    urls.push(stored.url);
  }

  return NextResponse.json({ urls }, { status: 201 });
}
