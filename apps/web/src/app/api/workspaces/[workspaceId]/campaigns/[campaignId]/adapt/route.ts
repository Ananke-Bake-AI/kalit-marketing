/**
 * POST /api/workspaces/:workspaceId/campaigns/:campaignId/adapt
 *
 * Adapts an existing campaign for a new ad platform.
 * Generates platform-specific ad groups and adds them to the campaign.
 * The campaign stays as one entity with ad groups tagged by platform.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kalit/db";
import { llmComplete, parseJSON } from "@/lib/llm/client";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ workspaceId: string; campaignId: string }>;
}

interface GeneratedAdGroup {
  name: string;
  targeting: Record<string, unknown>;
  placements?: string[];
  dailyBudget?: number;
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
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { workspaceId, campaignId } = await ctx.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const body = await req.json();
  const targetPlatform = body.platform as string;

  if (!targetPlatform) {
    return NextResponse.json({ error: "platform is required" }, { status: 400 });
  }

  // Load the campaign with its existing ad groups
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      workspace: { include: { config: true } },
      adGroups: {
        include: {
          creatives: { include: { creative: true } },
        },
      },
    },
  });

  if (!campaign || campaign.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Check if this platform already has ad groups
  const existingPlatformGroups = campaign.adGroups.filter(
    (ag) => ag.platform === targetPlatform
  );
  if (existingPlatformGroups.length > 0) {
    return NextResponse.json({
      error: `Campaign already has ${existingPlatformGroups.length} ad group(s) for ${targetPlatform}`,
    }, { status: 400 });
  }

  // Build context from existing campaign
  const existingAdGroups = campaign.adGroups.map((ag) => ({
    name: ag.name,
    platform: ag.platform,
    targeting: ag.targeting,
    creatives: ag.creatives.map((c) => ({
      headline: (c.creative.content as Record<string, unknown>)?.headline,
      body: (c.creative.content as Record<string, unknown>)?.body,
      cta: (c.creative.content as Record<string, unknown>)?.cta,
      destinationUrl: (c.creative.content as Record<string, unknown>)?.destinationUrl,
    })),
  }));

  const config = campaign.workspace.config;
  const websiteUrl = config?.productUrl || "https://example.com";
  const productName = config?.productName || campaign.workspace.name;

  const platformInstructions: Record<string, string> = {
    google: `Adapt for Google Ads (paid_search):
- Create 1-2 ad groups with RSA format: 10-15 headlines (max 30 chars each) and 4 descriptions (max 90 chars each)
- Keywords should be search-intent terms (what people type into Google)
- Do NOT include followerLookalikes or conversationTopics (X-only features)
- Use the same landing page URL with utm_source=google`,
    meta: `Adapt for Meta Ads (Facebook/Instagram):
- Create 1-2 ad sets with 3-5 ad variations each
- Ad body can be longer (up to 500 chars), conversational social tone
- Interests should be from Meta's interest taxonomy
- Include age, gender targeting. Devices: mobile, desktop
- Do NOT include keywords or followerLookalikes (X-only features)`,
    x: `Adapt for X (Twitter) Ads:
- Create 1 ad group with 2-3 promoted tweet variations
- Tweet body max 280 chars, conversational and punchy
- Include keywords (what people tweet about), interests, followerLookalikes
- Use X's interest taxonomy (Startups, Entrepreneurship, Tech news, etc.)`,
    linkedin: `Adapt for LinkedIn Ads:
- Create 1 ad group with 2-4 ad variations
- Professional B2B tone, focus on business value
- Target by job titles, industries, company sizes
- Do NOT include keywords or followerLookalikes`,
    tiktok: `Adapt for TikTok Ads:
- Create 1-2 ad groups with 3-5 variations
- Short, attention-grabbing copy. Casual, authentic tone
- First line is everything — hook immediately`,
  };

  const systemPrompt = `You adapt ad campaigns for new platforms. Given an existing campaign with ad groups for one platform, create NEW ad groups optimized for a different platform.

${platformInstructions[targetPlatform] || "Adapt the campaign for " + targetPlatform}

Keep the same:
- Target audience and messaging angle
- Budget allocation (proportional)
- Landing page URLs (update utm_source)

Change:
- Ad copy format and length to match the platform
- Targeting fields to match what the platform supports
- Number of ads/variations per platform best practices

Return ONLY a JSON array of ad group objects:
[{
  "name": "string — descriptive name including platform",
  "targeting": { ... platform-specific targeting },
  "placements": ["string"],
  "dailyBudget": number,
  "ads": [{
    "headline": "string",
    "headlines": ["string — for RSA"],
    "body": "string",
    "cta": "string",
    "destinationUrl": "${websiteUrl}?utm_source=${targetPlatform}&utm_medium=paid&utm_campaign=...",
    "descriptions": ["string — for RSA"]
  }]
}]

Return ONLY raw JSON array. No markdown fences.`;

  const prompt = `CAMPAIGN: ${campaign.name}
Objective: ${campaign.objective}
Target audience: ${campaign.targetAudience}
Messaging angle: ${campaign.messagingAngle}
Daily budget: $${campaign.dailyBudget} | Total: $${campaign.totalBudget}
Product: ${productName} (${websiteUrl})

EXISTING AD GROUPS (${campaign.adGroups[0]?.platform || "unknown"} platform):
${JSON.stringify(existingAdGroups, null, 2)}

Create new ad groups adapted for ${targetPlatform}. JSON array only.`;

  try {
    const response = await llmComplete({
      model: "claude-sonnet-4-6",
      system: systemPrompt,
      prompt,
      maxTokens: 4096,
    });

    let adGroups: GeneratedAdGroup[] = [];
    try {
      const cleaned = response.text.trim().replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
      adGroups = parseJSON<GeneratedAdGroup[]>(cleaned);
    } catch (_e) {
      adGroups = parseJSON<GeneratedAdGroup[]>(response.text);
    }

    if (!Array.isArray(adGroups) || adGroups.length === 0) {
      return NextResponse.json({ error: "AI returned no ad groups" }, { status: 500 });
    }

    // Persist new ad groups with platform tag
    let totalAds = 0;
    const createdGroups: string[] = [];

    for (const agData of adGroups) {
      const adGroup = await prisma.adGroup.create({
        data: {
          campaignId,
          name: agData.name,
          platform: targetPlatform,
          targeting: (agData.targeting ?? {}) as object,
          placements: agData.placements ?? [],
          dailyBudget: agData.dailyBudget ?? null,
        },
      });
      createdGroups.push(adGroup.id);

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

    // Update campaign platform to null (multi-platform) if it was single
    if (campaign.platform && campaign.platform !== targetPlatform) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { platform: null },
      });
    }

    // Tag existing ad groups that don't have a platform set
    if (campaign.platform) {
      await prisma.adGroup.updateMany({
        where: { campaignId, platform: null },
        data: { platform: campaign.platform },
      });
    }

    return NextResponse.json({
      success: true,
      platform: targetPlatform,
      adGroups: createdGroups.length,
      totalAds,
    });
  } catch (err) {
    console.error("[campaign-adapt] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Adaptation failed" },
      { status: 500 }
    );
  }
}
