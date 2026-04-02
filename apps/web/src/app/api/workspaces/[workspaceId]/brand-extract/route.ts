import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";
import { extractAndUpdateBrandIdentity } from "@/lib/brand/extract";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * POST — Extract brand identity (colors, palette) from uploaded workspace assets.
 * Updates WorkspaceConfig.colorPalette with the results.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  try {
    const result = await extractAndUpdateBrandIdentity(workspaceId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
