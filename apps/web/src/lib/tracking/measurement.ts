/**
 * Measurement & Attribution Module
 *
 * Computes measurement confidence scores and manages attribution.
 * Gated budget optimization — won't scale until confidence is high.
 */

import { prisma, Prisma } from "@kalit/db";
import type { MeasurementConfidence } from "@kalit/core";

/**
 * Compute measurement confidence for a workspace.
 * Returns a 0–1 score across 5 factors.
 */
export async function computeMeasurementConfidence(
  workspaceId: string
): Promise<MeasurementConfidence> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      connectedAccounts: true,
      campaigns: { where: { status: "active" } },
    },
  });

  if (!workspace) {
    return {
      overall: 0,
      factors: {
        pixelHealth: 0,
        conversionTracking: 0,
        attributionReliability: 0,
        sampleSize: 0,
        dataFreshness: 0,
      },
    };
  }

  // Factor 1: Pixel health — are tracking pixels connected?
  const hasAnalytics = workspace.connectedAccounts.some(
    (a) => a.platform === "ga4" && a.isActive
  );
  const hasAdPixels = workspace.connectedAccounts.some(
    (a) => (a.platform === "meta" || a.platform === "google") && a.isActive
  );
  const pixelHealth = hasAnalytics && hasAdPixels ? 1.0 : hasAdPixels ? 0.6 : hasAnalytics ? 0.4 : 0;

  // Factor 2: Conversion tracking — are conversion events flowing?
  const recentConversions = await prisma.campaign.aggregate({
    where: {
      workspaceId,
      status: "active",
      conversions: { gt: 0 },
    },
    _sum: { conversions: true },
    _count: true,
  });
  const hasConversions = (recentConversions._sum.conversions ?? 0) > 0;
  const conversionTracking = hasConversions ? 1.0 : 0.2;

  // Factor 3: Attribution reliability — consistency across platforms
  const activeCampaigns = workspace.campaigns;
  const campaignsWithConfidence = activeCampaigns.filter(
    (c) => c.measurementConfidence !== null
  );
  const attributionReliability =
    campaignsWithConfidence.length > 0
      ? campaignsWithConfidence.reduce(
          (sum, c) => sum + (c.measurementConfidence ?? 0),
          0
        ) / campaignsWithConfidence.length
      : 0.3;

  // Factor 4: Sample size — enough data for decisions?
  const totalImpressions = activeCampaigns.reduce(
    (sum, c) => sum + c.impressions,
    0
  );
  const totalConversions = activeCampaigns.reduce(
    (sum, c) => sum + c.conversions,
    0
  );
  // Need at least 1000 impressions and 10 conversions for minimal confidence
  const sampleSize = Math.min(
    1.0,
    (totalImpressions / 10000) * 0.5 + (totalConversions / 50) * 0.5
  );

  // Factor 5: Data freshness — when was data last synced?
  const lastSync = workspace.connectedAccounts.reduce(
    (latest, a) => {
      if (a.lastSyncAt && (!latest || a.lastSyncAt > latest)) return a.lastSyncAt;
      return latest;
    },
    null as Date | null
  );
  const hoursSinceSync = lastSync
    ? (Date.now() - lastSync.getTime()) / (1000 * 60 * 60)
    : 999;
  const dataFreshness =
    hoursSinceSync < 1 ? 1.0 : hoursSinceSync < 6 ? 0.8 : hoursSinceSync < 24 ? 0.5 : 0.2;

  const factors = {
    pixelHealth,
    conversionTracking,
    attributionReliability,
    sampleSize,
    dataFreshness,
  };

  // Weighted overall score
  const weights = {
    pixelHealth: 0.2,
    conversionTracking: 0.3,
    attributionReliability: 0.2,
    sampleSize: 0.2,
    dataFreshness: 0.1,
  };

  const overall = Object.entries(factors).reduce(
    (sum, [key, value]) =>
      sum + value * weights[key as keyof typeof weights],
    0
  );

  return { overall: Math.round(overall * 100) / 100, factors };
}

/**
 * Sync performance data from connected ad platforms into the canonical model.
 */
export async function syncPerformanceData(workspaceId: string): Promise<{
  campaignsUpdated: number;
  errors: string[];
}> {
  const { getAdapter } = await import("../adapters");

  const campaigns = await prisma.campaign.findMany({
    where: {
      workspaceId,
      status: { in: ["active", "paused", "optimizing"] },
      NOT: { platformCampaignIds: { equals: Prisma.DbNull } },
    },
  });

  const connectedAccounts = await prisma.connectedAccount.findMany({
    where: { workspaceId, isActive: true },
  });

  let campaignsUpdated = 0;
  const errors: string[] = [];

  // Group campaigns by platform
  for (const account of connectedAccounts) {
    const adapter = getAdapter(account.platform);
    if (!adapter) continue;

    const credentials = account.credentials as {
      accessToken: string;
      refreshToken?: string;
    };

    const platformCampaigns = campaigns.filter((c) => {
      const ids = c.platformCampaignIds as Record<string, string> | null;
      return ids && ids[account.platform];
    });

    if (platformCampaigns.length === 0) continue;

    try {
      const platformIds = platformCampaigns.map((c) => {
        const ids = c.platformCampaignIds as Record<string, string>;
        return ids[account.platform];
      });

      const today = new Date();
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const perfData = await adapter.getPerformance(
        {
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
          accountId: account.accountId,
        },
        platformIds,
        {
          start: sevenDaysAgo.toISOString().split("T")[0],
          end: today.toISOString().split("T")[0],
        }
      );

      // Aggregate performance per campaign
      for (const campaign of platformCampaigns) {
        const ids = campaign.platformCampaignIds as Record<string, string>;
        const platformId = ids[account.platform];
        const data = perfData.filter(
          (d) => d.campaignPlatformId === platformId
        );

        if (data.length === 0) continue;

        const totals = data.reduce(
          (acc, d) => ({
            impressions: acc.impressions + d.impressions,
            clicks: acc.clicks + d.clicks,
            conversions: acc.conversions + d.conversions,
            spend: acc.spend + d.spend,
            revenue: acc.revenue + d.revenue,
          }),
          { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 }
        );

        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            impressions: totals.impressions,
            clicks: totals.clicks,
            conversions: totals.conversions,
            spend: totals.spend,
            revenue: totals.revenue,
            ctr:
              totals.impressions > 0
                ? totals.clicks / totals.impressions
                : null,
            cpc: totals.clicks > 0 ? totals.spend / totals.clicks : null,
            cpa:
              totals.conversions > 0
                ? totals.spend / totals.conversions
                : null,
            roas: totals.spend > 0 ? totals.revenue / totals.spend : null,
          },
        });

        campaignsUpdated++;
      }

      // Update last sync timestamp
      await prisma.connectedAccount.update({
        where: { id: account.id },
        data: { lastSyncAt: new Date() },
      });
    } catch (err) {
      errors.push(
        `${account.platform}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  return { campaignsUpdated, errors };
}
