import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";
import {
  generateImage,
  generateVideo,
  generateComparison,
  listAllProviders,
} from "@/lib/adapters/image-gen/registry";
import type { ReferenceImage } from "@/lib/adapters/content-types";
import { storeFile } from "@/lib/storage";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET — List available providers and their capabilities.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;
  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  return NextResponse.json({ providers: listAllProviders() });
}

/**
 * POST — Generate an image or video using specified provider(s).
 *
 * Body:
 *   mode: "single" | "compare" | "video"
 *   providers: string[]            — provider IDs to use
 *   prompt: string                 — generation prompt
 *   assetIds?: string[]            — workspace asset IDs to use as references
 *   aspectRatio?: string
 *   style?: string
 *   duration?: number              — for video mode
 *   saveToCreatives?: boolean      — persist results as Creative records
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;
  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const body = await request.json();
  const {
    mode = "single",
    providers = [],
    prompt,
    assetIds = [],
    aspectRatio = "1:1",
    style,
    duration,
    saveToCreatives = false,
    negativePrompt,
  } = body as {
    mode: "single" | "compare" | "video";
    providers: string[];
    prompt: string;
    assetIds?: string[];
    aspectRatio?: string;
    style?: string;
    duration?: number;
    saveToCreatives?: boolean;
    negativePrompt?: string;
  };

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (!providers.length) {
    return NextResponse.json({ error: "At least one provider is required" }, { status: 400 });
  }

  // Resolve brand asset references
  let referenceImages: ReferenceImage[] = [];
  if (assetIds.length > 0) {
    const assets = await prisma.workspaceAsset.findMany({
      where: { id: { in: assetIds }, workspaceId },
    });

    referenceImages = assets.map((asset) => ({
      url: `${process.env.NEXTAUTH_URL ?? "http://localhost:3002"}${asset.url}`,
      type: (
        asset.category === "logo" ? "logo"
        : asset.category === "color_swatch" ? "color_palette"
        : asset.category === "brand_image" || asset.category === "product_screenshot" ? "subject"
        : "style"
      ) as ReferenceImage["type"],
      weight: asset.isPrimary ? 0.9 : 0.7,
    }));
  }

  // Also fetch workspace context for the prompt enrichment
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { config: true },
  });

  // Enrich prompt with brand context
  let enrichedPrompt = prompt;
  if (workspace?.config) {
    const cfg = workspace.config;
    const brandContext = [
      cfg.productName ? `Brand: ${cfg.productName}` : "",
      cfg.brandVoice ? `Tone: ${cfg.brandVoice}` : "",
      cfg.industry ? `Industry: ${cfg.industry}` : "",
    ].filter(Boolean).join(". ");

    if (brandContext) {
      enrichedPrompt = `${prompt}\n\nBrand context: ${brandContext}`;
    }
  }

  try {
    if (mode === "video") {
      const result = await generateVideo(providers[0], {
        prompt: enrichedPrompt,
        referenceImage: referenceImages[0]?.url,
        duration,
        aspectRatio: aspectRatio as "16:9" | "9:16" | "1:1",
        style,
      });

      return NextResponse.json({ mode: "video", result });
    }

    const spec = {
      prompt: enrichedPrompt,
      negativePrompt,
      aspectRatio: aspectRatio as "1:1" | "16:9" | "9:16" | "4:5",
      style,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
    };

    if (mode === "compare") {
      const results = await generateComparison(providers, spec);

      // Optionally save successful results as creatives
      if (saveToCreatives) {
        for (const [providerId, result] of Object.entries(results)) {
          if ("error" in result) continue;
          await saveResultAsCreative(workspaceId, result, providerId);
        }
      }

      return NextResponse.json({ mode: "compare", results });
    }

    // Single provider
    const result = await generateImage(providers[0], spec);

    // Download and store the generated image locally
    const stored = await downloadAndStore(workspaceId, result);

    if (saveToCreatives) {
      await saveResultAsCreative(workspaceId, { ...result, url: stored.url }, providers[0]);
    }

    return NextResponse.json({
      mode: "single",
      result: { ...result, url: stored.url, storedUrl: stored.url },
    });

  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────

async function downloadAndStore(
  workspaceId: string,
  result: { url: string; model: string }
) {
  try {
    // Handle data URLs (base64)
    if (result.url.startsWith("data:")) {
      const match = result.url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const buffer = Buffer.from(match[2], "base64");
        const ext = mimeType === "image/png" ? ".png" : ".jpg";
        return await storeFile(workspaceId, buffer, `generated-${result.model}${ext}`, mimeType);
      }
    }

    // Download from URL
    const res = await fetch(result.url);
    if (!res.ok) return { url: result.url };

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "image/png";
    const ext = contentType.includes("png") ? ".png" : contentType.includes("webp") ? ".webp" : ".jpg";
    return await storeFile(workspaceId, buffer, `generated-${result.model}-${Date.now()}${ext}`, contentType);
  } catch {
    // If download fails, return original URL
    return { url: result.url };
  }
}

async function saveResultAsCreative(
  workspaceId: string,
  result: { url: string; prompt: string; model: string; provider: string },
  providerId: string
) {
  await prisma.creative.create({
    data: {
      workspaceId,
      type: "static_image",
      status: "draft",
      title: `AI Generated — ${providerId}`,
      content: { prompt: result.prompt, model: result.model, provider: result.provider },
      mediaUrls: [result.url],
      tags: ["ai-generated", result.provider, result.model],
    },
  });
}
