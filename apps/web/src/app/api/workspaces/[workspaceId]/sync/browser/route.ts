import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kalit/db";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

const browserSyncSchema = z.object({
  platform: z.string(),
  pageType: z.string(),
  scrapedAt: z.string(),
  url: z.string(),
  summary: z.record(z.number().nullable()).default({}),
  campaigns: z
    .array(
      z.object({
        name: z.string(),
        impressions: z.number().nullable().optional(),
        clicks: z.number().nullable().optional(),
        spend: z.number().nullable().optional(),
        ctr: z.number().nullable().optional(),
        cpc: z.number().nullable().optional(),
        conversions: z.number().nullable().optional(),
        cpa: z.number().nullable().optional(),
        roas: z.number().nullable().optional(),
        engagements: z.number().nullable().optional(),
      })
    )
    .default([]),
  rawTables: z.any().optional(),
});

/**
 * POST — Receive browser-scraped performance data from the Kalit extension.
 *
 * The extension scrapes ads.x.com (or other platforms) and sends structured
 * performance data here. We match scraped campaigns to our DB campaigns
 * and update their metrics.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const body = await request.json();
  const parsed = browserSyncSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid sync data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const syncData = parsed.data;

  // Find campaigns in our DB that match the scraped names
  const dbCampaigns = await prisma.campaign.findMany({
    where: {
      workspaceId,
      platform: syncData.platform,
      status: { in: ["active", "paused", "optimizing", "scaling", "monitoring"] },
    },
  });

  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const scraped of syncData.campaigns) {
    // Fuzzy match by name
    const dbCampaign = dbCampaigns.find(
      (c) =>
        c.name.toLowerCase() === scraped.name.toLowerCase() ||
        c.name.toLowerCase().includes(scraped.name.toLowerCase()) ||
        scraped.name.toLowerCase().includes(c.name.toLowerCase())
    );

    if (dbCampaign) {
      // Update campaign metrics
      await prisma.campaign.update({
        where: { id: dbCampaign.id },
        data: {
          impressions: scraped.impressions ?? dbCampaign.impressions,
          clicks: scraped.clicks ?? dbCampaign.clicks,
          spend: scraped.spend ?? dbCampaign.spend,
          conversions: scraped.conversions ?? dbCampaign.conversions,
          ctr: scraped.ctr ?? dbCampaign.ctr,
          cpc: scraped.cpc ?? dbCampaign.cpc,
          cpa: scraped.cpa ?? dbCampaign.cpa,
          roas: scraped.roas ?? dbCampaign.roas,
        },
      });
      matched.push(scraped.name);
    } else {
      unmatched.push(scraped.name);
    }
  }

  // Log the sync event
  await prisma.event.create({
    data: {
      workspaceId,
      type: "browser_sync",
      data: {
        platform: syncData.platform,
        pageType: syncData.pageType,
        scrapedAt: syncData.scrapedAt,
        url: syncData.url,
        summaryMetrics: Object.keys(syncData.summary).length,
        campaignsScraped: syncData.campaigns.length,
        campaignsMatched: matched.length,
        campaignsUnmatched: unmatched.length,
        matched,
        unmatched,
      },
    },
  });

  return NextResponse.json({
    success: true,
    platform: syncData.platform,
    scrapedCampaigns: syncData.campaigns.length,
    matchedCampaigns: matched.length,
    unmatchedCampaigns: unmatched,
    summaryMetrics: syncData.summary,
  });
}
