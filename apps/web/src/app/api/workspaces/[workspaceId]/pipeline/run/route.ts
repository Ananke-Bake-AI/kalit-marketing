/**
 * Full Pipeline Execution Endpoint
 *
 * POST /api/workspaces/:workspaceId/pipeline/run
 *
 * Runs the complete campaign generation pipeline in one call:
 * 1. Analyze website URL → extract context → save to config + memories
 * 2. Research + Strategy → single Claude call for market analysis + growth plan
 * 3. Campaign Architecture → Claude generates full Google Ads campaign structure
 * 4. Persist → Campaign, AdGroup, Creative records in DB
 *
 * Body: { url: string, platform?: "google" | "meta", dryRun?: boolean }
 */

import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { llmComplete, parseJSON } from "@/lib/llm/client";
import {
  persistCampaigns,
  type CampaignArchitectOutput,
} from "@/lib/engine/campaign-persister";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

// ─── Step 1: Fetch & analyze website ───────────────────────────

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

  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<meta[^>]*content="([^"]*)"[^>]*>/gi, "\nMETA: $1\n")
    .replace(/<title[^>]*>([\s\S]*?)<\/title>/gi, "\nTITLE: $1\n")
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, "\nHEADING: $1\n")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "\nLINK[$1]: $2\n")
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, "\nIMAGE_ALT: $1\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 10000);
}

async function analyzeWebsite(
  workspaceId: string,
  url: string,
  websiteContent: string
): Promise<{
  productName: string;
  productDescription: string;
  industry: string;
  brandVoice: string;
  targetAudience: string;
  competitors: string[];
  keyFeatures: string[];
  valueProposition: string;
  contentThemes: string[];
}> {
  const response = await llmComplete({
    model: "claude-sonnet-4-6",
    maxTokens: 2048,
    system: `You are an expert marketing analyst. Extract structured information from a website to build a marketing campaign context.

Output ONLY valid JSON (no markdown fences) with this structure:
{
  "productName": "string",
  "productDescription": "string — clear 2-3 sentence description",
  "industry": "string",
  "brandVoice": "string — describe the tone and style",
  "targetAudience": "string — who the product is for",
  "competitors": ["string"],
  "keyFeatures": ["string"],
  "valueProposition": "string — the main value proposition",
  "contentThemes": ["string — recurring themes"]
}

Be specific and factual based on what you find in the content.`,
    prompt: `Analyze this website content from ${url}:\n\n${websiteContent}`,
  });

  try {
    return parseJSON(response.text);
  } catch {
    throw new Error(`Failed to parse website analysis: ${response.text.slice(0, 300)}`);
  }
}

// ─── Step 2: Generate full campaign architecture ───────────────

async function generateCampaignArchitecture(
  platform: string,
  context: {
    productName: string;
    productDescription: string;
    industry: string;
    brandVoice: string;
    targetAudience: string;
    competitors: string[];
    keyFeatures: string[];
    valueProposition: string;
    contentThemes: string[];
    websiteUrl: string;
    monthlyBudget: number;
    primaryGoal: string;
    currency: string;
  }
): Promise<CampaignArchitectOutput> {
  const platformGuidance =
    platform === "google"
      ? `Google Ads specifics:
- Campaign types: SEARCH (for high-intent keywords), DISPLAY (for awareness), PERFORMANCE_MAX (for sales/conversions)
- Create responsive search ads with multiple headlines (max 30 chars each) and descriptions (max 90 chars each)
- Include 3+ headlines and 2+ descriptions per ad for Google's rotation system
- Use keyword-based ad groups organized by intent (branded, competitor, problem-aware, solution-aware)
- Set destination URLs using the product website
- Focus on search intent keywords that match the product's value proposition`
      : `Meta Ads specifics:
- Campaign objectives: CONVERSIONS, TRAFFIC, AWARENESS
- Create ad sets with interest/demographic targeting
- Include image ad specs and carousel options
- Use Facebook/Instagram placements`;

  const response = await llmComplete({
    model: "claude-sonnet-4-6",
    maxTokens: 8192,
    system: `You are an elite growth marketing architect. You design complete, ready-to-launch ${platform === "google" ? "Google Ads" : "Meta Ads"} campaigns.

${platformGuidance}

Given a product's context, create a comprehensive campaign structure that is READY to be uploaded to ${platform === "google" ? "Google Ads" : "Meta"}.

Output ONLY valid JSON (no markdown fences) with this exact structure:
{
  "campaigns": [
    {
      "name": "string — descriptive campaign name",
      "type": "paid_search",
      "objective": "conversions",
      "targetAudience": "string — who this campaign targets",
      "messagingAngle": "string — the core message/positioning",
      "hypothesis": "string — what we're testing",
      "dailyBudget": number,
      "totalBudget": number,
      "adGroups": [
        {
          "name": "string — ad group name",
          "targeting": {
            "keywords": ["string — target keywords"],
            "locations": ["string — geo targets"],
            "ageMin": number,
            "ageMax": number,
            "devices": ["mobile", "desktop"]
          },
          "placements": ["search", "display"],
          "ads": [
            {
              "headline": "string — primary headline (max 30 chars for Google)",
              "body": "string — primary description (max 90 chars for Google)",
              "cta": "string — call to action",
              "destinationUrl": "string — landing page URL",
              "descriptions": ["string — additional headlines/descriptions for responsive ads"],
              "messagingAngle": "string",
              "tags": ["string"]
            }
          ]
        }
      ]
    }
  ]
}

Requirements:
- Create 2-3 campaigns covering different objectives/angles
- Each campaign should have 2-3 ad groups organized by intent or audience
- Each ad group should have 2-3 ad variations testing different hooks/angles
- Budget allocation should be strategic (highest budget on highest-intent campaigns)
- All headlines and descriptions must meet platform character limits
- Use the actual product website as destination URL
- Be specific and conversion-focused — no generic copy`,
    prompt: `Create a complete ${platform === "google" ? "Google Ads" : "Meta Ads"} campaign structure for this product:

## Product
Name: ${context.productName}
Description: ${context.productDescription}
Website: ${context.websiteUrl}
Industry: ${context.industry}

## Brand
Voice: ${context.brandVoice}
Value Proposition: ${context.valueProposition}
Key Features: ${context.keyFeatures.join(", ")}

## Target
Audience: ${context.targetAudience}
Primary Goal: ${context.primaryGoal}

## Competition
Competitors: ${context.competitors.join(", ")}
Content Themes: ${context.contentThemes.join(", ")}

## Budget
Monthly: ${context.currency} ${context.monthlyBudget}
Daily (approx): ${context.currency} ${Math.round(context.monthlyBudget / 30)}

Design campaigns that will drive ${context.primaryGoal} for ${context.productName}. Allocate the daily budget across campaigns strategically.`,
  });

  try {
    return parseJSON<CampaignArchitectOutput>(response.text);
  } catch {
    throw new Error(
      `Failed to parse campaign architecture: ${response.text.slice(0, 500)}`
    );
  }
}

// ─── Main handler ──────────────────────────────────────────────

export async function POST(request: NextRequest, ctx: RouteContext) {
  const { workspaceId } = await ctx.params;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { config: true },
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

  const url = body.url as string;
  const platform = (body.platform as string) || "google";

  if (!url) {
    return NextResponse.json(
      { error: "url is required" },
      { status: 400 }
    );
  }

  const steps: Record<string, unknown> = {};
  const startTime = Date.now();

  try {
    // ── Step 1: Fetch website ──────────────────────────────────
    console.log(`[pipeline] Step 1: Fetching ${url}`);
    const websiteContent = await fetchWebsiteContent(url);
    steps.fetch = { chars: websiteContent.length };

    // ── Step 2: Analyze with Claude ────────────────────────────
    console.log(`[pipeline] Step 2: Analyzing website with Claude`);
    const analysis = await analyzeWebsite(workspaceId, url, websiteContent);
    steps.analysis = analysis;

    // Save analysis to workspace config
    const config = workspace.config;
    if (config) {
      await prisma.workspaceConfig.update({
        where: { workspaceId },
        data: {
          productUrl: url,
          ...(analysis.productName && !config.productName
            ? { productName: analysis.productName }
            : {}),
          ...(analysis.productDescription && !config.productDescription
            ? { productDescription: analysis.productDescription }
            : {}),
          ...(analysis.industry && !config.industry
            ? { industry: analysis.industry }
            : {}),
          ...(analysis.brandVoice && !config.brandVoice
            ? { brandVoice: analysis.brandVoice }
            : {}),
          ...(analysis.targetAudience && !config.icpDescription
            ? { icpDescription: analysis.targetAudience }
            : {}),
        },
      });
    }

    // Save memories
    const memoryEntries = [
      analysis.valueProposition && {
        type: "brand_learning",
        title: "Value Proposition",
        content: analysis.valueProposition,
        tags: ["brand", "positioning"],
        confidence: 0.9,
      },
      analysis.keyFeatures?.length > 0 && {
        type: "brand_learning",
        title: "Key Product Features",
        content: analysis.keyFeatures.join("; "),
        tags: ["features", "product"],
        confidence: 0.85,
      },
      analysis.competitors?.length > 0 && {
        type: "audience_insight",
        title: "Known Competitors",
        content: `Competitors: ${analysis.competitors.join(", ")}`,
        tags: ["competitors", "market"],
        confidence: 0.7,
      },
      analysis.targetAudience && {
        type: "audience_insight",
        title: "Target Audience",
        content: analysis.targetAudience,
        tags: ["audience", "icp"],
        confidence: 0.8,
      },
    ].filter(Boolean) as Array<{
      type: string;
      title: string;
      content: string;
      tags: string[];
      confidence: number;
    }>;

    for (const entry of memoryEntries) {
      await prisma.memory.create({
        data: {
          workspaceId,
          type: entry.type as never,
          title: entry.title,
          content: entry.content,
          tags: entry.tags,
          confidence: entry.confidence,
          source: `pipeline:${url}`,
        },
      });
    }
    steps.memories = { created: memoryEntries.length };

    // ── Step 3: Generate campaign architecture ─────────────────
    console.log(`[pipeline] Step 3: Generating ${platform} campaign architecture`);
    const campaignOutput = await generateCampaignArchitecture(platform, {
      productName: analysis.productName || config?.productName || workspace.name,
      productDescription:
        analysis.productDescription || config?.productDescription || "",
      industry: analysis.industry || config?.industry || "technology",
      brandVoice: analysis.brandVoice || config?.brandVoice || "professional",
      targetAudience: analysis.targetAudience || config?.icpDescription || "",
      competitors: analysis.competitors || [],
      keyFeatures: analysis.keyFeatures || [],
      valueProposition: analysis.valueProposition || "",
      contentThemes: analysis.contentThemes || [],
      websiteUrl: url,
      monthlyBudget: config?.monthlyBudget || 5000,
      primaryGoal: config?.primaryGoal || "conversions",
      currency: config?.currency || "USD",
    });

    steps.architecture = {
      campaigns: campaignOutput.campaigns.length,
      totalAdGroups: campaignOutput.campaigns.reduce(
        (s, c) => s + c.adGroups.length,
        0
      ),
      totalAds: campaignOutput.campaigns.reduce(
        (s, c) => s + c.adGroups.reduce((s2, ag) => s2 + ag.ads.length, 0),
        0
      ),
    };

    // ── Step 4: Persist to database ────────────────────────────
    console.log(`[pipeline] Step 4: Persisting campaigns to database`);
    const persisted = await persistCampaigns(
      workspaceId,
      campaignOutput,
      config?.currency || "USD"
    );

    steps.persisted = persisted;

    // Log event
    await prisma.event.create({
      data: {
        workspaceId,
        type: "task_completed" as never,
        data: {
          pipeline: "full_campaign_generation",
          platform,
          url,
          campaigns: persisted.length,
          totalCreatives: persisted.reduce(
            (s, p) => s + p.creativeIds.length,
            0
          ),
          durationMs: Date.now() - startTime,
        },
      },
    });

    // ── Return full result ─────────────────────────────────────
    const duration = Date.now() - startTime;
    console.log(`[pipeline] Done in ${duration}ms`);

    return NextResponse.json({
      success: true,
      duration: `${(duration / 1000).toFixed(1)}s`,
      steps,
      campaigns: campaignOutput.campaigns.map((c, i) => ({
        ...c,
        dbId: persisted[i]?.campaignId,
        adGroups: c.adGroups.map((ag) => ({
          ...ag,
          adsCount: ag.ads.length,
        })),
      })),
      summary: {
        campaignsCreated: persisted.length,
        adGroupsCreated: persisted.reduce(
          (s, p) => s + p.adGroupIds.length,
          0
        ),
        creativesCreated: persisted.reduce(
          (s, p) => s + p.creativeIds.length,
          0
        ),
        platform,
        websiteAnalyzed: url,
      },
    });
  } catch (error) {
    console.error("[pipeline] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Pipeline failed",
        steps,
        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      },
      { status: 500 }
    );
  }
}
