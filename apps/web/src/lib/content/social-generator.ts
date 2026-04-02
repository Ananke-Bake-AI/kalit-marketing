/**
 * Social Content Generator
 *
 * Orchestrates Claude (text) + image generation (visuals) to produce
 * ready-to-post social media content across multiple platforms.
 *
 * Single Claude call generates all platform variants at once.
 * Images are generated per unique aspect ratio then mapped to platforms.
 */

import { prisma } from "@kalit/db";
import Anthropic from "@anthropic-ai/sdk";
import { generateImage } from "@/lib/adapters/image-gen/registry";
import { storeFile } from "@/lib/storage";
import type { ReferenceImage } from "@/lib/adapters/content-types";

// ─── Types ───────────────────────────────────────────────────────

export interface SocialGenerationBrief {
  workspaceId: string;
  prompt: string;
  platforms: string[]; // x, meta, linkedin, reddit, tiktok
  assetIds?: string[];
  importedImageUrls?: string[];
  imageProviderId?: string;
  generateImages?: boolean;
  tone?: string;
}

export interface SocialPostOutput {
  platform: string;
  content: string;
  hashtags: string[];
  mentions: string[];
  charCount: number;
  charLimit: number;
}

export interface SocialGenerationResult {
  creativeId: string;
  posts: Array<{
    id: string; // SocialPost ID (draft)
    platform: string;
    content: string;
    hashtags: string[];
    mediaUrls: string[];
    charCount: number;
    charLimit: number;
  }>;
  imageUrls: Record<string, string[]>; // keyed by aspect ratio
  summary: string;
}

// ─── Platform Specs ──────────────────────────────────────────────

interface PlatformSpec {
  maxChars: number;
  imageAspect: "1:1" | "16:9" | "9:16" | "4:5";
  imageWidth: number;
  imageHeight: number;
  tone: string;
  hashtagStyle: "inline" | "block" | "none";
  name: string;
}

const PLATFORM_SPECS: Record<string, PlatformSpec> = {
  x: {
    maxChars: 280,
    imageAspect: "16:9",
    imageWidth: 1200,
    imageHeight: 675,
    tone: "punchy, direct, conversational",
    hashtagStyle: "inline",
    name: "X (Twitter)",
  },
  meta: {
    maxChars: 2200,
    imageAspect: "1:1",
    imageWidth: 1080,
    imageHeight: 1080,
    tone: "engaging, conversational, relatable",
    hashtagStyle: "block",
    name: "Instagram / Facebook",
  },
  linkedin: {
    maxChars: 3000,
    imageAspect: "16:9",
    imageWidth: 1200,
    imageHeight: 627,
    tone: "professional, thought-leadership, value-driven",
    hashtagStyle: "block",
    name: "LinkedIn",
  },
  reddit: {
    maxChars: 40000,
    imageAspect: "16:9",
    imageWidth: 1200,
    imageHeight: 628,
    tone: "authentic, community-first, no corporate speak",
    hashtagStyle: "none",
    name: "Reddit",
  },
  tiktok: {
    maxChars: 2200,
    imageAspect: "9:16",
    imageWidth: 1080,
    imageHeight: 1920,
    tone: "casual, trendy, hook-first",
    hashtagStyle: "inline",
    name: "TikTok",
  },
};

export { PLATFORM_SPECS };

// ─── Main Generator ──────────────────────────────────────────────

function getAnthropic() {
  return new Anthropic();
}

export async function generateSocialContent(
  brief: SocialGenerationBrief
): Promise<SocialGenerationResult> {
  const shouldGenImages = brief.generateImages !== false;

  // 1. Fetch workspace context
  const workspace = await prisma.workspace.findUnique({
    where: { id: brief.workspaceId },
    include: {
      config: true,
      memories: {
        where: { confidence: { gte: 0.5 } },
        orderBy: { confidence: "desc" },
        take: 10,
      },
      growthPlans: {
        where: { isActive: true },
        orderBy: { version: "desc" },
        take: 1,
      },
      assets: {
        where: brief.assetIds?.length
          ? { id: { in: brief.assetIds } }
          : { isPrimary: true },
        orderBy: [{ isPrimary: "desc" }, { category: "asc" }],
        take: 10,
      },
    },
  });

  if (!workspace) throw new Error(`Workspace ${brief.workspaceId} not found`);

  const config = workspace.config;
  const validPlatforms = brief.platforms.filter((p) => PLATFORM_SPECS[p]);
  if (validPlatforms.length === 0) throw new Error("No valid platforms selected");

  // 2. Build Claude prompt for all platforms
  const contextParts: string[] = [];

  if (config) {
    contextParts.push(`## Brand Context`);
    contextParts.push(`Product: ${config.productName} — ${config.productDescription}`);
    if (config.productUrl) contextParts.push(`URL: ${config.productUrl}`);
    if (config.industry) contextParts.push(`Industry: ${config.industry}`);
    if (config.brandVoice) contextParts.push(`Brand Voice: ${config.brandVoice}`);
    if (config.icpDescription) contextParts.push(`Target Audience: ${config.icpDescription}`);
    if (config.colorPalette) {
      const palette = config.colorPalette as { colors?: Array<{ hex: string; label: string }> };
      if (palette.colors?.length) {
        contextParts.push(`Brand Colors: ${palette.colors.map((c) => `${c.hex} (${c.label})`).join(", ")}`);
      }
    }
  }

  if (workspace.memories.length > 0) {
    contextParts.push(`\n## Insights from past campaigns`);
    for (const mem of workspace.memories.slice(0, 5)) {
      contextParts.push(`- [${mem.type}] ${mem.title}: ${mem.content}`);
    }
  }

  const growthPlan = workspace.growthPlans[0];
  if (growthPlan) {
    const angles = growthPlan.messagingAngles as Array<{ angle: string; hook: string }>;
    if (Array.isArray(angles) && angles.length > 0) {
      contextParts.push(`\n## Active messaging angles`);
      for (const a of angles.slice(0, 3)) {
        contextParts.push(`- ${a.angle}: "${a.hook}"`);
      }
    }
  }

  // Platform specs for Claude
  const platformInstructions = validPlatforms.map((p) => {
    const spec = PLATFORM_SPECS[p];
    return `- **${spec.name}** (key: "${p}"): max ${spec.maxChars} chars, tone: ${spec.tone}, hashtags: ${spec.hashtagStyle === "none" ? "do not include" : spec.hashtagStyle === "block" ? "add as a block at the end" : "weave naturally into text"}`;
  });

  const systemPrompt = `You are an expert social media content creator for startups. You produce platform-native posts that feel organic, not like ads.

Rules:
- Each platform gets content tailored to its culture and constraints
- Respect character limits strictly
- Match the brand voice from context
- Use hooks that stop the scroll
- Hashtags follow each platform's convention
- Never use generic filler — be specific to the product
- ${brief.tone ? `Override tone: ${brief.tone}` : "Match brand voice from context"}

Output ONLY valid JSON (no markdown fences):
{
  "platforms": {
    "<platform_key>": {
      "content": "the full post text (within char limit)",
      "hashtags": ["tag1", "tag2"],
      "mentions": []
    }
  },
  "imagePrompt": "a detailed image generation prompt that matches the post theme, brand style, and product — describe the visual vividly for an AI image generator",
  "summary": "one-line summary of what was generated"
}`;

  const userPrompt = `${contextParts.join("\n")}

## User Request
${brief.prompt}

## Platforms to generate for
${platformInstructions.join("\n")}

Generate compelling, platform-native social media posts for each platform above.`;

  // 3. Call Claude
  const response = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textContent = response.content.find((c) => c.type === "text");
  const rawText = textContent?.text ?? "";

  let parsed: {
    platforms: Record<string, { content: string; hashtags: string[]; mentions: string[] }>;
    imagePrompt?: string;
    summary?: string;
  };

  try {
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse Claude response: ${rawText.slice(0, 300)}`);
  }

  if (!parsed.platforms) throw new Error("Claude response missing 'platforms' object");

  // 4. Generate images per unique aspect ratio
  const imageUrlsByAspect: Record<string, string[]> = {};

  if (shouldGenImages && parsed.imagePrompt) {
    // Determine unique aspect ratios needed
    const aspectRatios = new Set(
      validPlatforms.map((p) => PLATFORM_SPECS[p].imageAspect)
    );

    // Build reference images from workspace assets
    const referenceImages: ReferenceImage[] = workspace.assets.map((asset) => ({
      url: `${process.env.NEXTAUTH_URL ?? "http://localhost:3002"}${asset.url}`,
      type: (
        asset.category === "logo" ? "logo"
        : asset.category === "color_swatch" ? "color_palette"
        : "style"
      ) as ReferenceImage["type"],
      weight: asset.isPrimary ? 0.9 : 0.7,
    }));

    // Add imported images as subject references
    if (brief.importedImageUrls?.length) {
      for (const url of brief.importedImageUrls) {
        referenceImages.push({ url, type: "subject", weight: 0.85 });
      }
    }

    const providerId = brief.imageProviderId || "google-nano-banana-pro";

    // Generate one image per unique aspect ratio (in parallel)
    const genPromises = [...aspectRatios].map(async (aspect) => {
      try {
        const result = await generateImage(providerId, {
          prompt: parsed.imagePrompt!,
          aspectRatio: aspect,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        });

        // Download and store locally
        let storedUrl = result.url;
        try {
          if (result.url.startsWith("data:")) {
            const match = result.url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              const buffer = Buffer.from(match[2], "base64");
              const stored = await storeFile(brief.workspaceId, buffer, `social-${aspect.replace(":", "x")}-${Date.now()}.png`, match[1]);
              storedUrl = stored.url;
            }
          } else {
            const imgRes = await fetch(result.url);
            if (imgRes.ok) {
              const buffer = Buffer.from(await imgRes.arrayBuffer());
              const ct = imgRes.headers.get("content-type") ?? "image/png";
              const ext = ct.includes("png") ? ".png" : ".jpg";
              const stored = await storeFile(brief.workspaceId, buffer, `social-${aspect.replace(":", "x")}-${Date.now()}${ext}`, ct);
              storedUrl = stored.url;
            }
          }
        } catch {
          // Keep original URL if storage fails
        }

        imageUrlsByAspect[aspect] = [storedUrl];
      } catch {
        imageUrlsByAspect[aspect] = brief.importedImageUrls?.length
          ? [brief.importedImageUrls[0]]
          : [];
      }
    });

    await Promise.all(genPromises);
  } else if (brief.importedImageUrls?.length) {
    // Use imported images for all platforms
    for (const p of validPlatforms) {
      const aspect = PLATFORM_SPECS[p].imageAspect;
      if (!imageUrlsByAspect[aspect]) {
        imageUrlsByAspect[aspect] = [brief.importedImageUrls[0]];
      }
    }
  }

  // 5. Create Creative record
  const allMediaUrls = Object.values(imageUrlsByAspect).flat();

  const creative = await prisma.creative.create({
    data: {
      workspaceId: brief.workspaceId,
      type: "social_post",
      status: "draft",
      title: parsed.summary ?? brief.prompt.slice(0, 80),
      content: {
        prompt: brief.prompt,
        platforms: parsed.platforms,
        imagePrompt: parsed.imagePrompt,
      },
      mediaUrls: allMediaUrls,
      tags: ["social", ...validPlatforms],
    },
  });

  // 6. Create SocialPost drafts (one per platform)
  const posts: SocialGenerationResult["posts"] = [];

  for (const platform of validPlatforms) {
    const spec = PLATFORM_SPECS[platform];
    const platformData = parsed.platforms[platform];
    if (!platformData) continue;

    const content = platformData.content;
    const hashtags = platformData.hashtags ?? [];
    const mediaUrls = imageUrlsByAspect[spec.imageAspect] ?? [];

    const post = await prisma.socialPost.create({
      data: {
        workspaceId: brief.workspaceId,
        platform: platform as never,
        creativeId: creative.id,
        content,
        mediaUrls,
        status: "draft",
      },
    });

    posts.push({
      id: post.id,
      platform,
      content,
      hashtags,
      mediaUrls,
      charCount: content.length,
      charLimit: spec.maxChars,
    });
  }

  return {
    creativeId: creative.id,
    posts,
    imageUrls: imageUrlsByAspect,
    summary: parsed.summary ?? "Social content generated",
  };
}
