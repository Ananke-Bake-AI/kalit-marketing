import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kalit/db";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

// ── Schemas ──────────────────────────────────────────────────

const metricsSchema = z.object({
  impressions: z.number().nullable().optional(),
  clicks: z.number().nullable().optional(),
  spend: z.number().nullable().optional(),
  conversions: z.number().nullable().optional(),
  revenue: z.number().nullable().optional(),
  ctr: z.number().nullable().optional(),
  cpc: z.number().nullable().optional(),
  cpm: z.number().nullable().optional(),
  cpa: z.number().nullable().optional(),
  roas: z.number().nullable().optional(),
  engagements: z.number().nullable().optional(),
  reach: z.number().nullable().optional(),
  frequency: z.number().nullable().optional(),
  videoViews: z.number().nullable().optional(),
  followers: z.number().nullable().optional(),
  likes: z.number().nullable().optional(),
  retweets: z.number().nullable().optional(),
  shares: z.number().nullable().optional(),
  replies: z.number().nullable().optional(),
  saves: z.number().nullable().optional(),
}).passthrough();

const canonicalCampaignSchema = z.object({
  name: z.string(),
  platformId: z.string().optional(),
  status: z.string().optional(),
  objective: z.string().optional(),
  budget: z.object({
    daily: z.number().optional(),
    total: z.number().optional(),
    currency: z.string().optional(),
  }).optional(),
  metrics: metricsSchema.default({}),
  adGroups: z.array(z.object({
    name: z.string(),
    platformId: z.string().optional(),
    status: z.string().optional(),
    metrics: metricsSchema.default({}),
    targeting: z.any().optional(),
    creatives: z.array(z.object({
      name: z.string(),
      platformId: z.string().optional(),
      type: z.string().optional(),
      status: z.string().optional(),
      metrics: metricsSchema.default({}),
      content: z.any().optional(),
    })).optional(),
  })).optional(),
});

// Legacy format (single-page scrape)
const legacySyncSchema = z.object({
  platform: z.string(),
  pageType: z.string().optional(),
  scrapedAt: z.string().optional(),
  url: z.string().optional(),
  summary: z.record(z.number().nullable()).optional(),
  campaigns: z.array(z.object({
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
  })).default([]),
  rawTables: z.any().optional(),
});

// Canonical format (multi-page crawl)
const canonicalSyncSchema = z.object({
  platform: z.string(),
  syncedAt: z.string().optional(),
  accountOverview: metricsSchema.optional(),
  campaigns: z.array(canonicalCampaignSchema).default([]),
  audienceInsights: z.array(z.object({
    dimension: z.string(),
    segments: z.array(z.object({
      label: z.string(),
      metrics: metricsSchema.default({}),
    })),
  })).optional(),
  conversionEvents: z.array(z.object({
    name: z.string(),
    count: z.number().optional(),
    value: z.number().optional(),
    attribution: z.string().optional(),
  })).optional(),
  crawledPages: z.array(z.object({
    url: z.string(),
    pageType: z.string(),
    scrapedAt: z.string(),
  })).optional(),
});

/**
 * POST — Receive browser-scraped performance data from the Kalit extension.
 *
 * Accepts two formats:
 * 1. Legacy: flat campaigns with metrics (single-page scrape)
 * 2. Canonical: hierarchical campaigns with ad groups, audience insights,
 *    conversion events (multi-page crawl)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const body = await request.json();

  // Detect format: canonical has nested campaigns with .metrics, legacy has flat metrics
  const isCanonical = body.campaigns?.[0]?.metrics !== undefined || body.crawledPages !== undefined;

  if (isCanonical) {
    return handleCanonicalSync(workspaceId, body);
  }
  return handleLegacySync(workspaceId, body);
}

// ── Canonical format handler ────────────────────────────────

async function handleCanonicalSync(workspaceId: string, body: unknown) {
  const parsed = canonicalSyncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid canonical sync data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const syncData = parsed.data;

  // Find all campaigns in this workspace for the platform
  const dbCampaigns = await prisma.campaign.findMany({
    where: {
      workspaceId,
      platform: syncData.platform,
      status: { in: ["active", "paused", "optimizing", "launching"] },
    },
    include: {
      adGroups: { select: { id: true, name: true } },
    },
  });

  const matched: string[] = [];
  const unmatched: string[] = [];
  let adGroupsUpdated = 0;

  for (const scraped of syncData.campaigns) {
    const dbCampaign = fuzzyMatchCampaign(dbCampaigns, scraped.name);

    if (dbCampaign) {
      // Update campaign metrics
      const m = scraped.metrics;
      await prisma.campaign.update({
        where: { id: dbCampaign.id },
        data: {
          impressions: m.impressions ?? undefined,
          clicks: m.clicks ?? undefined,
          spend: m.spend ?? undefined,
          conversions: m.conversions ?? undefined,
          revenue: m.revenue ?? undefined,
          ctr: m.ctr ?? undefined,
          cpc: m.cpc ?? undefined,
          cpa: m.cpa ?? undefined,
          roas: m.roas ?? undefined,
        },
      });
      matched.push(scraped.name);

      // Update ad groups if available
      if (scraped.adGroups && scraped.adGroups.length > 0) {
        for (const scrapedAg of scraped.adGroups) {
          const dbAg = (dbCampaign.adGroups as Array<{ id: string; name: string }>).find(
            (ag) => ag.name.toLowerCase() === scrapedAg.name.toLowerCase() ||
                    ag.name.toLowerCase().includes(scrapedAg.name.toLowerCase()) ||
                    scrapedAg.name.toLowerCase().includes(ag.name.toLowerCase())
          );
          if (dbAg) {
            const agm = scrapedAg.metrics;
            await prisma.adGroup.update({
              where: { id: dbAg.id },
              data: {
                impressions: agm.impressions ?? undefined,
                clicks: agm.clicks ?? undefined,
                conversions: agm.conversions ?? undefined,
                spend: agm.spend ?? undefined,
              },
            });
            adGroupsUpdated++;
          }
        }
      }
    } else {
      unmatched.push(scraped.name);
    }
  }

  // Store the full canonical sync data as an event for analysis
  await prisma.event.create({
    data: {
      workspaceId,
      type: "performance_anomaly",
      data: JSON.parse(JSON.stringify({
        syncType: "browser_canonical",
        platform: syncData.platform,
        syncedAt: syncData.syncedAt || new Date().toISOString(),
        crawledPages: syncData.crawledPages?.length || 0,
        campaignsScraped: syncData.campaigns.length,
        campaignsMatched: matched.length,
        campaignsUnmatched: unmatched.length,
        adGroupsUpdated,
        matched,
        unmatched,
        accountOverview: syncData.accountOverview || null,
        audienceInsights: syncData.audienceInsights || null,
        conversionEvents: syncData.conversionEvents || null,
        campaignDetails: syncData.campaigns.slice(0, 20).map(c => ({
          name: c.name,
          status: c.status,
          metrics: c.metrics,
          adGroupCount: c.adGroups?.length || 0,
        })),
      })),
    },
  });

  return NextResponse.json({
    success: true,
    format: "canonical",
    platform: syncData.platform,
    scrapedCampaigns: syncData.campaigns.length,
    matchedCampaigns: matched.length,
    unmatchedCampaigns: unmatched,
    adGroupsUpdated,
    crawledPages: syncData.crawledPages?.length || 0,
    audienceInsights: syncData.audienceInsights?.length || 0,
    conversionEvents: syncData.conversionEvents?.length || 0,
  });
}

// ── Legacy format handler ───────────────────────────────────

async function handleLegacySync(workspaceId: string, body: unknown) {
  const parsed = legacySyncSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid sync data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const syncData = parsed.data;

  const dbCampaigns = await prisma.campaign.findMany({
    where: {
      workspaceId,
      platform: syncData.platform,
      status: { in: ["active", "paused", "optimizing", "launching"] },
    },
  });

  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const scraped of syncData.campaigns) {
    const dbCampaign = fuzzyMatchCampaign(dbCampaigns, scraped.name);

    if (dbCampaign) {
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

  await prisma.event.create({
    data: {
      workspaceId,
      type: "performance_anomaly",
      data: JSON.parse(JSON.stringify({
        syncType: "browser_legacy",
        platform: syncData.platform,
        pageType: syncData.pageType,
        scrapedAt: syncData.scrapedAt,
        url: syncData.url,
        summaryMetrics: Object.keys(syncData.summary || {}).length,
        campaignsScraped: syncData.campaigns.length,
        campaignsMatched: matched.length,
        campaignsUnmatched: unmatched.length,
        matched,
        unmatched,
      })),
    },
  });

  return NextResponse.json({
    success: true,
    format: "legacy",
    platform: syncData.platform,
    scrapedCampaigns: syncData.campaigns.length,
    matchedCampaigns: matched.length,
    unmatchedCampaigns: unmatched,
    summaryMetrics: syncData.summary,
  });
}

// ── Helpers ─────────────────────────────────────────────────

function fuzzyMatchCampaign(
  dbCampaigns: Array<{ id: string; name: string; [key: string]: unknown }>,
  scrapedName: string
) {
  const lower = scrapedName.toLowerCase();
  return dbCampaigns.find(
    (c) =>
      c.name.toLowerCase() === lower ||
      c.name.toLowerCase().includes(lower) ||
      lower.includes(c.name.toLowerCase())
  );
}
