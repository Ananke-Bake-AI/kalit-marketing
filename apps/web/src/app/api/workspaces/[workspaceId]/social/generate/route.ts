import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";
import { generateSocialContent, PLATFORM_SPECS } from "@/lib/content/social-generator";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET — Return available platforms and their specs.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;
  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  return NextResponse.json({
    platforms: Object.entries(PLATFORM_SPECS).map(([key, spec]) => ({
      id: key,
      name: spec.name,
      maxChars: spec.maxChars,
      imageAspect: spec.imageAspect,
      tone: spec.tone,
    })),
  });
}

/**
 * POST — Generate social media content across platforms.
 *
 * Body:
 *   prompt: string           — What to post about
 *   platforms: string[]      — Platform keys (x, meta, linkedin, reddit, tiktok)
 *   assetIds?: string[]      — Brand asset IDs to use as references
 *   importedImageUrls?: string[] — Additional image URLs
 *   imageProviderId?: string — AI provider for image generation
 *   generateImages?: boolean — Whether to generate images (default true)
 *   tone?: string            — Override brand voice
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;
  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const body = await request.json();

  if (!body.prompt || typeof body.prompt !== "string") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (!body.platforms?.length) {
    return NextResponse.json({ error: "At least one platform is required" }, { status: 400 });
  }

  try {
    const result = await generateSocialContent({
      workspaceId,
      prompt: body.prompt,
      platforms: body.platforms,
      assetIds: body.assetIds,
      importedImageUrls: body.importedImageUrls,
      imageProviderId: body.imageProviderId,
      generateImages: body.generateImages,
      tone: body.tone,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
