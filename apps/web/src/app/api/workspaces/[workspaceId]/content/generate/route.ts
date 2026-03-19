import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { generateContent, type ContentBrief } from "@/lib/content/pipeline";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

const VALID_TYPES = [
  "ad_copy",
  "social_post",
  "email_copy",
  "carousel",
  "static_image",
  "video_script",
] as const;

/**
 * POST — Trigger content generation for a workspace.
 *
 * Body: ContentBrief (workspaceId is taken from the URL param)
 * Returns: { creativeIds, variations, imageUrls }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  // Validate workspace exists
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });

  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: 404 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Validate required fields
  const type = body.type as string;
  if (!type || !VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const brief: ContentBrief = {
    workspaceId,
    type: type as ContentBrief["type"],
    targetSegment: body.targetSegment as string | undefined,
    messagingAngle: body.messagingAngle as string | undefined,
    hypothesis: body.hypothesis as string | undefined,
    channel: body.channel as string | undefined,
    tone: body.tone as string | undefined,
    numVariations: typeof body.numVariations === "number" ? body.numVariations : undefined,
    generateImage: typeof body.generateImage === "boolean" ? body.generateImage : undefined,
  };

  // Check for API key before attempting generation
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "sk-ant-xxx") {
    return NextResponse.json(
      { error: "Content generation requires an Anthropic API key. Add ANTHROPIC_API_KEY to your environment variables." },
      { status: 503 }
    );
  }

  try {
    const result = await generateContent(brief);

    return NextResponse.json({
      creativeIds: result.creativeIds,
      variations: result.copyVariations,
      imageUrls: result.imageUrls ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Content generation failed";
    // Clean up raw API errors for user-facing display
    const userMessage = message.includes("authentication_error")
      ? "API key is invalid. Please check your ANTHROPIC_API_KEY."
      : message.includes("rate_limit")
        ? "Rate limit reached. Please try again in a moment."
        : message;
    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    );
  }
}
