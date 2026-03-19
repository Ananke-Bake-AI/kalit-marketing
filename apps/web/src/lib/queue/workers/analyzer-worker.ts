import { Worker, type Job } from "bullmq";
import { prisma } from "@kalit/db";
import { getRedisConnectionOptions } from "../connection";

export interface AnalyzerJobData {
  workspaceId: string;
  type: "website" | "file";
  url?: string;
  content?: string; // raw text from uploaded file
  fileName?: string;
}

interface ExtractedContext {
  productName?: string;
  productDescription?: string;
  industry?: string;
  brandVoice?: string;
  targetAudience?: string;
  competitors?: string[];
  keyFeatures?: string[];
  socialLinks?: Record<string, string>;
  pricing?: string;
  valueProposition?: string;
  contentThemes?: string[];
  tone?: string;
}

/**
 * Fetch and extract text content from a URL.
 */
async function fetchWebsiteContent(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "KalitBot/1.0 (marketing-research)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const html = await response.text();

  // Extract useful text from HTML (strip tags, scripts, styles)
  const cleaned = html
    // Remove script and style blocks
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    // Extract meta tags content
    .replace(/<meta[^>]*content="([^"]*)"[^>]*>/gi, "\nMETA: $1\n")
    // Extract title
    .replace(/<title[^>]*>([\s\S]*?)<\/title>/gi, "\nTITLE: $1\n")
    // Extract headings
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, "\nHEADING: $1\n")
    // Extract links with href
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "\nLINK[$1]: $2\n")
    // Extract alt text from images
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, "\nIMAGE_ALT: $1\n")
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, " ")
    // Decode HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();

  // Limit to ~8000 chars to stay within token limits
  return cleaned.slice(0, 8000);
}

/**
 * Use Claude to extract structured context from website/file content.
 */
async function analyzeWithClaude(
  content: string,
  sourceType: "website" | "file",
  sourceUrl?: string
): Promise<ExtractedContext> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: `You are an expert marketing analyst. Extract structured information from ${sourceType} content to build a marketing campaign context.

Output ONLY valid JSON (no markdown fences) with this structure:
{
  "productName": "string — the product/company name",
  "productDescription": "string — clear 1-2 sentence description of what the product does",
  "industry": "string — industry/vertical (e.g., fintech, healthtech, SaaS, ecommerce)",
  "brandVoice": "string — description of the brand's tone and style (e.g., professional, casual, bold)",
  "targetAudience": "string — who the product is for",
  "competitors": ["string — names of competitors mentioned or implied"],
  "keyFeatures": ["string — key product features or benefits"],
  "socialLinks": {"platform": "url"} — any social media links found,
  "pricing": "string — pricing info if found, or null",
  "valueProposition": "string — the main value proposition",
  "contentThemes": ["string — recurring content themes or topics"],
  "tone": "string — one of: professional, casual, bold, playful, authoritative, friendly"
}

Extract what you can find. For fields without clear data, omit them. Be specific and factual — do not make up information that isn't in the source.`,
    messages: [
      {
        role: "user",
        content: `Analyze this ${sourceType} content${sourceUrl ? ` from ${sourceUrl}` : ""}:\n\n${content}`,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === "text");
  const rawText = textContent?.text ?? "{}";

  try {
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
    return JSON.parse(jsonStr) as ExtractedContext;
  } catch {
    console.error("[analyzer] Failed to parse Claude response:", rawText.slice(0, 200));
    return {};
  }
}

/**
 * Save extracted context to workspace config and memories.
 */
async function saveExtractedContext(
  workspaceId: string,
  context: ExtractedContext,
  sourceUrl?: string
): Promise<{ configUpdated: boolean; memoriesCreated: number }> {
  let memoriesCreated = 0;

  // Update workspace config with extracted data (only fill in empty fields)
  const existingConfig = await prisma.workspaceConfig.findUnique({
    where: { workspaceId },
  });

  if (existingConfig) {
    const updates: Record<string, unknown> = {};

    if (!existingConfig.productName && context.productName) {
      updates.productName = context.productName;
    }
    if (!existingConfig.productDescription && context.productDescription) {
      updates.productDescription = context.productDescription;
    }
    if (!existingConfig.industry && context.industry) {
      updates.industry = context.industry;
    }
    if (!existingConfig.brandVoice && context.brandVoice) {
      updates.brandVoice = context.brandVoice;
    }
    if (!existingConfig.icpDescription && context.targetAudience) {
      updates.icpDescription = context.targetAudience;
    }
    if (!existingConfig.productUrl && sourceUrl) {
      updates.productUrl = sourceUrl;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.workspaceConfig.update({
        where: { workspaceId },
        data: updates,
      });
    }
  }

  // Save extracted insights as workspace memories
  const memoryEntries: Array<{
    type: string;
    title: string;
    content: string;
    tags: string[];
    confidence: number;
  }> = [];

  if (context.valueProposition) {
    memoryEntries.push({
      type: "brand_learning",
      title: "Value Proposition",
      content: context.valueProposition,
      tags: ["brand", "positioning", "value-prop"],
      confidence: 0.9,
    });
  }

  if (context.keyFeatures && context.keyFeatures.length > 0) {
    memoryEntries.push({
      type: "brand_learning",
      title: "Key Product Features",
      content: context.keyFeatures.join("; "),
      tags: ["features", "product"],
      confidence: 0.85,
    });
  }

  if (context.competitors && context.competitors.length > 0) {
    memoryEntries.push({
      type: "audience_insight",
      title: "Known Competitors",
      content: `Competitors identified: ${context.competitors.join(", ")}`,
      tags: ["competitors", "market"],
      confidence: 0.7,
    });
  }

  if (context.targetAudience) {
    memoryEntries.push({
      type: "audience_insight",
      title: "Target Audience",
      content: context.targetAudience,
      tags: ["audience", "icp"],
      confidence: 0.8,
    });
  }

  if (context.contentThemes && context.contentThemes.length > 0) {
    memoryEntries.push({
      type: "creative_pattern",
      title: "Content Themes from Website",
      content: context.contentThemes.join("; "),
      tags: ["content", "themes", "messaging"],
      confidence: 0.75,
    });
  }

  if (context.pricing) {
    memoryEntries.push({
      type: "brand_learning",
      title: "Pricing Information",
      content: context.pricing,
      tags: ["pricing", "product"],
      confidence: 0.85,
    });
  }

  if (context.socialLinks && Object.keys(context.socialLinks).length > 0) {
    memoryEntries.push({
      type: "channel_insight",
      title: "Social Media Presence",
      content: Object.entries(context.socialLinks)
        .map(([platform, url]) => `${platform}: ${url}`)
        .join("; "),
      tags: ["social", "channels"],
      confidence: 0.95,
    });
  }

  for (const entry of memoryEntries) {
    await prisma.memory.create({
      data: {
        workspaceId,
        type: entry.type as never,
        title: entry.title,
        content: entry.content,
        tags: entry.tags,
        confidence: entry.confidence,
        source: sourceUrl ? `website:${sourceUrl}` : "file_upload",
      },
    });
    memoriesCreated++;
  }

  // Log the analysis event
  await prisma.event.create({
    data: {
      workspaceId,
      type: "website_analyzed",
      data: {
        sourceUrl,
        fieldsExtracted: Object.keys(context).filter(
          (k) => context[k as keyof ExtractedContext] != null
        ),
        memoriesCreated,
      },
    },
  });

  return { configUpdated: !!existingConfig, memoriesCreated };
}

export function createAnalyzerWorker(): Worker {
  const worker = new Worker<AnalyzerJobData>(
    "analyzer",
    async (job: Job<AnalyzerJobData>) => {
      const { workspaceId, type, url, content } = job.data;

      console.log(`[analyzer] processing ${type} for workspace=${workspaceId}`);

      let textContent: string;

      if (type === "website" && url) {
        textContent = await fetchWebsiteContent(url);
      } else if (type === "file" && content) {
        textContent = content.slice(0, 8000); // Limit file content too
      } else {
        throw new Error("Invalid analyzer job: missing url or content");
      }

      // Analyze with Claude
      const extracted = await analyzeWithClaude(textContent, type, url);

      // Save to workspace
      const result = await saveExtractedContext(workspaceId, extracted, url);

      console.log(
        `[analyzer] done workspace=${workspaceId} memories=${result.memoriesCreated}`
      );

      return { extracted, ...result };
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 2,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[analyzer] failed workspace=${job?.data.workspaceId}`, err.message);
  });

  return worker;
}
