/**
 * Campaign Create API
 *
 * POST — Create a campaign from a natural-language prompt.
 * Claude generates the full structure (ad groups, targeting, ads) from the description.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kalit/db";
import { llmComplete, parseJSON } from "@/lib/llm/client";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

interface GeneratedCampaign {
  name: string;
  type: string;
  objective: string;
  targetAudience: string;
  messagingAngle: string;
  hypothesis: string;
  dailyBudget: number;
  totalBudget: number;
  adGroups: Array<{
    name: string;
    targeting: {
      keywords?: string[];
      ageMin?: number;
      ageMax?: number;
      locations?: string[];
      interests?: string[];
      devices?: string[];
    };
    placements?: string[];
    ads: Array<{
      headline: string;
      headlines?: string[];
      body: string;
      cta: string;
      destinationUrl: string;
      descriptions?: string[];
      messagingAngle?: string;
      tags?: string[];
    }>;
  }>;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { workspaceId } = await ctx.params;

  const body = await req.json();
  const prompt = body.prompt as string;

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { config: true },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const config = workspace.config;
  const websiteUrl = config?.productUrl || "https://example.com";
  const productName = config?.productName || workspace.name;
  const productDesc = config?.productDescription || "";
  const industry = config?.industry || "technology";

  const systemPrompt = `You are an elite growth marketing architect. You create complete, ready-to-launch Google Ads campaigns.

Given a campaign brief, generate a full campaign structure with ad groups, targeting, and ads.

Rules:
- Create compelling, specific ad copy — no generic marketing fluff
- Headlines max 30 characters, descriptions max 90 characters for Google Ads RSA
- Include 3-5 headlines per ad in the "headlines" array for RSA rotation
- Include 2-4 descriptions per ad in the "descriptions" array
- Keywords should be specific and match user intent
- Budget should be reasonable for the campaign goal
- Destination URL should use the product website
- Return ONLY valid JSON, no markdown fences

Product context:
- Name: ${productName}
- Description: ${productDesc}
- Industry: ${industry}
- Website: ${websiteUrl}
- Monthly budget: ${config?.currency || "USD"} ${config?.monthlyBudget || 5000}

JSON schema:
{
  "name": "string — campaign name prefixed with '${productName} — '",
  "type": "paid_search | paid_social | display | video | retargeting",
  "objective": "awareness | traffic | engagement | leads | conversions | sales",
  "targetAudience": "string",
  "messagingAngle": "string",
  "hypothesis": "string",
  "dailyBudget": number,
  "totalBudget": number,
  "adGroups": [{
    "name": "string",
    "targeting": {
      "keywords": ["string"],
      "ageMin": number,
      "ageMax": number,
      "locations": ["US"],
      "interests": ["string"],
      "devices": ["mobile", "desktop"]
    },
    "placements": ["search"],
    "ads": [{
      "headline": "string (max 30 chars)",
      "headlines": ["string (max 30 chars each) — at least 5 for RSA"],
      "body": "string (max 90 chars)",
      "cta": "string",
      "destinationUrl": "${websiteUrl}",
      "descriptions": ["string (max 90 chars each) — at least 3"],
      "messagingAngle": "string",
      "tags": ["string"]
    }]
  }]
}

Create 2-3 ad groups with 2-3 ads each. Be specific and conversion-focused.`;

  try {
    const response = await llmComplete({
      model: "claude-sonnet-4-6",
      system: systemPrompt,
      prompt: `Create a campaign based on this brief:\n\n${prompt}`,
      maxTokens: 8192,
    });

    const generated = parseJSON<GeneratedCampaign>(response.text);

    // Persist to database
    const campaign = await prisma.campaign.create({
      data: {
        workspaceId,
        name: generated.name,
        type: (generated.type || "paid_search") as never,
        objective: generated.objective || "conversions",
        status: "draft",
        targetAudience: generated.targetAudience,
        messagingAngle: generated.messagingAngle,
        hypothesis: generated.hypothesis,
        dailyBudget: generated.dailyBudget || 25,
        totalBudget: generated.totalBudget || 0,
        currency: config?.currency || "USD",
      },
    });

    let totalAds = 0;

    for (const agData of generated.adGroups) {
      const adGroup = await prisma.adGroup.create({
        data: {
          campaignId: campaign.id,
          name: agData.name,
          targeting: (agData.targeting ?? {}) as object,
          placements: agData.placements ?? [],
        },
      });

      for (const adData of agData.ads) {
        const creative = await prisma.creative.create({
          data: {
            workspaceId,
            type: "ad_copy",
            status: "draft",
            version: 1,
            title: adData.headline,
            content: {
              headline: adData.headline,
              headlines: adData.headlines ?? [],
              body: adData.body,
              cta: adData.cta,
              destinationUrl: adData.destinationUrl || websiteUrl,
              descriptions: adData.descriptions ?? [],
            },
            messagingAngle: adData.messagingAngle ?? null,
            tags: adData.tags ?? [],
          },
        });
        await prisma.adGroupCreative.create({
          data: {
            adGroupId: adGroup.id,
            creativeId: creative.id,
            isActive: true,
          },
        });
        totalAds++;
      }
    }

    await prisma.event.create({
      data: {
        workspaceId,
        type: "task_completed" as never,
        data: {
          action: "campaign_created_from_prompt",
          campaignId: campaign.id,
          prompt,
          adGroups: generated.adGroups.length,
          totalAds,
        },
      },
    });

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        adGroups: generated.adGroups.length,
        totalAds,
      },
    });
  } catch (err) {
    console.error("[campaign-create] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Creation failed" },
      { status: 500 }
    );
  }
}
