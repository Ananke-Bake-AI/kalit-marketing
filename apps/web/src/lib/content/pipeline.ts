import { prisma } from "@kalit/db";
import Anthropic from "@anthropic-ai/sdk";
import type { ImageGenerationAdapter } from "../adapters/content-types";
import { MockImageAdapter } from "../adapters/image-gen/mock";

function getAnthropic() {
  return new Anthropic();
}

export interface ContentBrief {
  workspaceId: string;
  type: "ad_copy" | "social_post" | "email_copy" | "carousel" | "static_image" | "video_script";
  targetSegment?: string;
  messagingAngle?: string;
  hypothesis?: string;
  channel?: string; // meta, google, tiktok, etc.
  tone?: string;
  numVariations?: number;
  generateImage?: boolean;
}

export interface GeneratedContent {
  creativeIds: string[];
  copyVariations: Array<{ headline: string; body: string; cta: string }>;
  imageUrls?: string[];
}

function getImageAdapter(): ImageGenerationAdapter {
  if (process.env.MOCK_ADAPTERS === "true") {
    return new MockImageAdapter();
  }
  const { DallEAdapter } = require("../adapters/image-gen/dall-e") as typeof import("../adapters/image-gen/dall-e");
  return new DallEAdapter();
}

/**
 * Generate marketing content using Claude for copy and optional image generation.
 *
 * 1. Fetches workspace context (config, brand voice, ICP, recent memories)
 * 2. Builds a detailed Claude prompt incorporating all context
 * 3. Calls Claude (claude-sonnet-4-6) to generate copy variations
 * 4. Optionally generates images via the image generation adapter
 * 5. Persists each variation as a Creative record in Prisma
 */
export async function generateContent(brief: ContentBrief): Promise<GeneratedContent> {
  const numVariations = brief.numVariations ?? 3;

  // 1. Fetch workspace context
  const workspace = await prisma.workspace.findUnique({
    where: { id: brief.workspaceId },
    include: {
      config: true,
      memories: {
        where: { confidence: { gte: 0.5 } },
        orderBy: { confidence: "desc" },
        take: 15,
      },
      growthPlans: {
        where: { isActive: true },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!workspace) {
    throw new Error(`Workspace ${brief.workspaceId} not found`);
  }

  const config = workspace.config;

  // 2. Build the Claude prompt with workspace context
  const contextParts: string[] = [];

  if (config) {
    contextParts.push(`## Brand & Product Context`);
    contextParts.push(`Product: ${config.productName}`);
    contextParts.push(`Description: ${config.productDescription}`);
    if (config.productUrl) contextParts.push(`URL: ${config.productUrl}`);
    if (config.industry) contextParts.push(`Industry: ${config.industry}`);
    if (config.stage) contextParts.push(`Stage: ${config.stage}`);
    if (config.icpDescription) contextParts.push(`ICP: ${config.icpDescription}`);
    if (config.brandVoice) contextParts.push(`Brand Voice: ${config.brandVoice}`);
    if (config.primaryGoal) contextParts.push(`Primary Goal: ${config.primaryGoal}`);
  }

  if (workspace.memories.length > 0) {
    contextParts.push(`\n## Learned Insights (from past campaigns)`);
    for (const mem of workspace.memories) {
      contextParts.push(`- [${mem.type}] ${mem.title}: ${mem.content} (confidence: ${mem.confidence})`);
    }
  }

  const growthPlan = workspace.growthPlans[0];
  if (growthPlan) {
    contextParts.push(`\n## Active Growth Plan`);
    const angles = growthPlan.messagingAngles as Array<{ angle: string; targetSegment: string; hook: string }>;
    if (Array.isArray(angles) && angles.length > 0) {
      contextParts.push(`Messaging Angles:`);
      for (const a of angles) {
        contextParts.push(`  - ${a.angle} → ${a.targetSegment}: "${a.hook}"`);
      }
    }
  }

  contextParts.push(`\n## Content Brief`);
  contextParts.push(`Type: ${brief.type}`);
  contextParts.push(`Number of variations: ${numVariations}`);
  if (brief.targetSegment) contextParts.push(`Target Segment: ${brief.targetSegment}`);
  if (brief.messagingAngle) contextParts.push(`Messaging Angle: ${brief.messagingAngle}`);
  if (brief.hypothesis) contextParts.push(`Hypothesis: ${brief.hypothesis}`);
  if (brief.channel) contextParts.push(`Channel: ${brief.channel}`);
  if (brief.tone) contextParts.push(`Tone: ${brief.tone}`);

  const systemPrompt = `You are an expert growth creative writer producing high-converting marketing content.

Rules:
- Write for conversion, not cleverness
- Match the brand voice provided in context
- Each variation should test a different angle, hook, or emotional driver
- Be specific and concrete — no generic filler
- Adapt format to the content type and channel

Output ONLY valid JSON (no markdown fences) with this structure:
{
  "variations": [
    {
      "headline": "string",
      "body": "string",
      "cta": "string",
      "messagingAngle": "string",
      "hypothesis": "string",
      "tags": ["string"]
    }
  ],
  "imagePrompt": "string (a detailed prompt for generating a matching visual, if applicable)"
}`;

  const userPrompt = contextParts.join("\n");

  // 3. Call Claude to generate copy
  const response = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textContent = response.content.find((c) => c.type === "text");
  const rawText = textContent?.text ?? "";

  let parsed: {
    variations: Array<{
      headline: string;
      body: string;
      cta: string;
      messagingAngle?: string;
      hypothesis?: string;
      tags?: string[];
    }>;
    imagePrompt?: string;
  };

  try {
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${rawText.slice(0, 500)}`);
  }

  if (!parsed.variations || !Array.isArray(parsed.variations)) {
    throw new Error("Claude response missing 'variations' array");
  }

  // 4. Optionally generate images
  let imageUrls: string[] | undefined;

  if (brief.generateImage && parsed.imagePrompt) {
    const adapter = getImageAdapter();
    const imageResults = await adapter.generateVariations(
      "",
      Math.min(numVariations, 3),
      parsed.imagePrompt
    );
    imageUrls = imageResults.map((r) => r.url);
  }

  // 5. Create Creative records in Prisma
  const creativeIds: string[] = [];
  const copyVariations: Array<{ headline: string; body: string; cta: string }> = [];

  for (let i = 0; i < parsed.variations.length; i++) {
    const variation = parsed.variations[i];
    const mediaUrls = imageUrls && imageUrls[i] ? [imageUrls[i]] : [];

    const creative = await prisma.creative.create({
      data: {
        workspaceId: brief.workspaceId,
        type: brief.type as never,
        status: "draft",
        version: 1,
        title: variation.headline,
        content: {
          headline: variation.headline,
          body: variation.body,
          cta: variation.cta,
        },
        mediaUrls,
        hypothesis: variation.hypothesis ?? brief.hypothesis ?? null,
        targetSegment: variation.messagingAngle
          ? `${brief.targetSegment ?? "general"} — ${variation.messagingAngle}`
          : brief.targetSegment ?? null,
        messagingAngle: variation.messagingAngle ?? brief.messagingAngle ?? null,
        tags: variation.tags ?? [],
      },
    });

    creativeIds.push(creative.id);
    copyVariations.push({
      headline: variation.headline,
      body: variation.body,
      cta: variation.cta,
    });
  }

  return {
    creativeIds,
    copyVariations,
    imageUrls,
  };
}
