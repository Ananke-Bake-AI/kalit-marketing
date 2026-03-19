import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const type = body.type as string;
  if (type !== "website" && type !== "file") {
    return NextResponse.json(
      { error: "Type must be 'website' or 'file'" },
      { status: 400 }
    );
  }

  if (type === "website") {
    const url = body.url as string;
    if (!url || !url.startsWith("http")) {
      return NextResponse.json(
        { error: "Valid URL required for website analysis" },
        { status: 400 }
      );
    }

    try {
      // Queue the analysis job
      const { getAnalyzerQueue } = await import("@/lib/queue/queues");
      const queue = getAnalyzerQueue();
      const job = await queue.add("analyze-website", {
        workspaceId,
        type: "website",
        url,
      });

      return NextResponse.json({
        jobId: job.id,
        status: "queued",
        message: "Website analysis started. Results will be saved to your workspace.",
      });
    } catch {
      // Fallback: run inline if queue is not available (dev mode)
      return await runInlineAnalysis(workspaceId, type, body.url as string);
    }
  }

  if (type === "file") {
    const content = body.content as string;
    const fileName = body.fileName as string;
    if (!content) {
      return NextResponse.json(
        { error: "File content required" },
        { status: 400 }
      );
    }

    try {
      const { getAnalyzerQueue } = await import("@/lib/queue/queues");
      const queue = getAnalyzerQueue();
      const job = await queue.add("analyze-file", {
        workspaceId,
        type: "file",
        content: content.slice(0, 10000),
        fileName,
      });

      return NextResponse.json({
        jobId: job.id,
        status: "queued",
        message: "File analysis started.",
      });
    } catch {
      return await runInlineAnalysis(workspaceId, type, undefined, content);
    }
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

/**
 * Fallback: run analysis inline when Redis/BullMQ is not available.
 */
async function runInlineAnalysis(
  workspaceId: string,
  type: "website" | "file",
  url?: string,
  content?: string
) {
  try {
    let textContent: string;

    if (type === "website" && url) {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "KalitBot/1.0 (marketing-research)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      const html = await response.text();
      textContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<meta[^>]*content="([^"]*)"[^>]*>/gi, "\nMETA: $1\n")
        .replace(/<title[^>]*>([\s\S]*?)<\/title>/gi, "\nTITLE: $1\n")
        .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, "\nHEADING: $1\n")
        .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "\nLINK[$1]: $2\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000);
    } else if (content) {
      textContent = content.slice(0, 8000);
    } else {
      throw new Error("No content to analyze");
    }

    // Call Claude for analysis
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: `You are an expert marketing analyst. Extract structured information from ${type} content to build a marketing campaign context.

Output ONLY valid JSON (no markdown fences) with this structure:
{
  "productName": "string",
  "productDescription": "string",
  "industry": "string",
  "brandVoice": "string",
  "targetAudience": "string",
  "competitors": ["string"],
  "keyFeatures": ["string"],
  "socialLinks": {"platform": "url"},
  "pricing": "string or null",
  "valueProposition": "string",
  "contentThemes": ["string"],
  "tone": "string"
}

Extract what you can find. Omit fields without clear data. Be factual.`,
      messages: [
        {
          role: "user",
          content: `Analyze this ${type} content${url ? ` from ${url}` : ""}:\n\n${textContent}`,
        },
      ],
    });

    const text = response.content.find((c) => c.type === "text")?.text ?? "{}";
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
    const extracted = JSON.parse(jsonStr);

    // Save to config (fill empty fields)
    const existingConfig = await prisma.workspaceConfig.findUnique({
      where: { workspaceId },
    });

    if (existingConfig) {
      const updates: Record<string, unknown> = {};
      if (!existingConfig.productName && extracted.productName) updates.productName = extracted.productName;
      if (!existingConfig.productDescription && extracted.productDescription) updates.productDescription = extracted.productDescription;
      if (!existingConfig.industry && extracted.industry) updates.industry = extracted.industry;
      if (!existingConfig.brandVoice && extracted.brandVoice) updates.brandVoice = extracted.brandVoice;
      if (!existingConfig.icpDescription && extracted.targetAudience) updates.icpDescription = extracted.targetAudience;
      if (!existingConfig.productUrl && url) updates.productUrl = url;

      if (Object.keys(updates).length > 0) {
        await prisma.workspaceConfig.update({
          where: { workspaceId },
          data: updates,
        });
      }
    }

    // Save memories
    let memoriesCreated = 0;
    const memories: Array<{ type: string; title: string; content: string; tags: string[]; confidence: number }> = [];

    if (extracted.valueProposition) {
      memories.push({ type: "brand_learning", title: "Value Proposition", content: extracted.valueProposition, tags: ["brand", "positioning"], confidence: 0.9 });
    }
    if (extracted.keyFeatures?.length) {
      memories.push({ type: "brand_learning", title: "Key Product Features", content: extracted.keyFeatures.join("; "), tags: ["features", "product"], confidence: 0.85 });
    }
    if (extracted.competitors?.length) {
      memories.push({ type: "audience_insight", title: "Known Competitors", content: `Competitors: ${extracted.competitors.join(", ")}`, tags: ["competitors"], confidence: 0.7 });
    }
    if (extracted.targetAudience) {
      memories.push({ type: "audience_insight", title: "Target Audience", content: extracted.targetAudience, tags: ["audience", "icp"], confidence: 0.8 });
    }
    if (extracted.contentThemes?.length) {
      memories.push({ type: "creative_pattern", title: "Content Themes", content: extracted.contentThemes.join("; "), tags: ["content", "themes"], confidence: 0.75 });
    }

    for (const mem of memories) {
      await prisma.memory.create({
        data: {
          workspaceId,
          type: mem.type as never,
          title: mem.title,
          content: mem.content,
          tags: mem.tags,
          confidence: mem.confidence,
          source: url ? `website:${url}` : "file_upload",
        },
      });
      memoriesCreated++;
    }

    return NextResponse.json({
      status: "completed",
      extracted,
      memoriesCreated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
