/**
 * Google Ads Execution Adapter
 *
 * Translates canonical campaign models into Google Ads API calls.
 * Handles: campaigns, ad groups, ads, performance retrieval, budget updates.
 *
 * API Reference: https://developers.google.com/google-ads/api/docs/start
 */

import type {
  ChannelAdapter,
  AdCredentials,
  AccountInfo,
  CampaignSpec,
  CampaignObjective,
  AdGroupSpec,
  AdSpec,
  PlatformCampaignResult,
  PlatformAdGroupResult,
  PlatformAdResult,
  DateRange,
  PerformanceData,
} from "./types";

const GOOGLE_ADS_API_VERSION = "v18";
const GOOGLE_ADS_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

// Map canonical objectives to Google campaign types
const campaignTypeMap: Record<CampaignObjective, string> = {
  awareness: "DISPLAY",
  traffic: "SEARCH",
  engagement: "DISPLAY",
  leads: "SEARCH",
  conversions: "SEARCH",
  sales: "PERFORMANCE_MAX",
};

const biddingStrategyMap: Record<CampaignObjective, string> = {
  awareness: "TARGET_IMPRESSION_SHARE",
  traffic: "MAXIMIZE_CLICKS",
  engagement: "MAXIMIZE_CLICKS",
  leads: "MAXIMIZE_CONVERSIONS",
  conversions: "MAXIMIZE_CONVERSIONS",
  sales: "MAXIMIZE_CONVERSION_VALUE",
};

async function googleFetch(
  endpoint: string,
  credentials: AdCredentials,
  options: RequestInit = {}
): Promise<unknown> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${GOOGLE_ADS_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "developer-token": credentials.metadata?.developerToken || "",
      "login-customer-id": credentials.metadata?.loginCustomerId || credentials.accountId,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const errors = (data as { error?: { message?: string } }).error;
    throw new Error(
      `Google Ads API error: ${errors?.message || res.statusText}`
    );
  }

  return data;
}

export const googleAdapter: ChannelAdapter = {
  platform: "google",

  async validateCredentials(credentials: AdCredentials): Promise<boolean> {
    try {
      await googleFetch(
        `/customers/${credentials.accountId}`,
        credentials
      );
      return true;
    } catch {
      return false;
    }
  },

  async getAccountInfo(credentials: AdCredentials): Promise<AccountInfo> {
    const data = (await googleFetch(
      `/customers/${credentials.accountId}`,
      credentials
    )) as {
      resourceName: string;
      descriptiveName: string;
      currencyCode: string;
      timeZone: string;
      status: string;
    };

    return {
      id: credentials.accountId,
      name: data.descriptiveName,
      currency: data.currencyCode,
      timezone: data.timeZone,
      status: data.status?.toLowerCase() || "unknown",
    };
  },

  async createCampaign(
    credentials: AdCredentials,
    campaign: CampaignSpec
  ): Promise<PlatformCampaignResult> {
    const campaignType = campaignTypeMap[campaign.objective] || "SEARCH";
    const biddingStrategy = biddingStrategyMap[campaign.objective] || "MAXIMIZE_CLICKS";

    // Create campaign budget first
    const budgetResult = (await googleFetch(
      `/customers/${credentials.accountId}/campaignBudgets:mutate`,
      credentials,
      {
        method: "POST",
        body: JSON.stringify({
          operations: [
            {
              create: {
                name: `${campaign.name} Budget`,
                amountMicros: Math.round(campaign.dailyBudget * 1_000_000).toString(),
                deliveryMethod: "STANDARD",
              },
            },
          ],
        }),
      }
    )) as { results: Array<{ resourceName: string }> };

    const budgetResourceName = budgetResult.results[0].resourceName;

    // Create campaign
    const campaignResult = (await googleFetch(
      `/customers/${credentials.accountId}/campaigns:mutate`,
      credentials,
      {
        method: "POST",
        body: JSON.stringify({
          operations: [
            {
              create: {
                name: campaign.name,
                advertisingChannelType: campaignType,
                status: campaign.status === "paused" ? "PAUSED" : "ENABLED",
                campaignBudget: budgetResourceName,
                biddingStrategyType: biddingStrategy,
                ...(campaign.startDate
                  ? { startDate: campaign.startDate.replace(/-/g, "") }
                  : {}),
                ...(campaign.endDate
                  ? { endDate: campaign.endDate.replace(/-/g, "") }
                  : {}),
                ...(campaign.targetGeos?.length
                  ? {
                      geoTargetTypeSetting: {
                        positiveGeoTargetType: "PRESENCE_OR_INTEREST",
                      },
                    }
                  : {}),
              },
            },
          ],
        }),
      }
    )) as { results: Array<{ resourceName: string }> };

    const resourceName = campaignResult.results[0].resourceName;
    const platformId = resourceName.split("/").pop() || resourceName;

    return {
      platformId,
      status: campaign.status === "paused" ? "PAUSED" : "ENABLED",
      effectiveDailyBudget: campaign.dailyBudget,
    };
  },

  async updateCampaign(
    credentials: AdCredentials,
    platformId: string,
    updates: Partial<CampaignSpec>
  ): Promise<PlatformCampaignResult> {
    const updateFields: Record<string, unknown> = {
      resourceName: `customers/${credentials.accountId}/campaigns/${platformId}`,
    };
    const updateMask: string[] = [];

    if (updates.name) {
      updateFields.name = updates.name;
      updateMask.push("name");
    }
    if (updates.status) {
      updateFields.status = updates.status === "paused" ? "PAUSED" : "ENABLED";
      updateMask.push("status");
    }

    await googleFetch(
      `/customers/${credentials.accountId}/campaigns:mutate`,
      credentials,
      {
        method: "POST",
        body: JSON.stringify({
          operations: [{ update: updateFields, updateMask: updateMask.join(",") }],
        }),
      }
    );

    return { platformId, status: updates.status === "paused" ? "PAUSED" : "ENABLED" };
  },

  async pauseCampaign(
    credentials: AdCredentials,
    platformId: string
  ): Promise<void> {
    await googleAdapter.updateCampaign(credentials, platformId, {
      status: "paused",
    });
  },

  async resumeCampaign(
    credentials: AdCredentials,
    platformId: string
  ): Promise<void> {
    await googleAdapter.updateCampaign(credentials, platformId, {
      status: "active",
    });
  },

  async createAdGroup(
    credentials: AdCredentials,
    campaignPlatformId: string,
    adGroup: AdGroupSpec
  ): Promise<PlatformAdGroupResult> {
    const result = (await googleFetch(
      `/customers/${credentials.accountId}/adGroups:mutate`,
      credentials,
      {
        method: "POST",
        body: JSON.stringify({
          operations: [
            {
              create: {
                name: adGroup.name,
                campaign: `customers/${credentials.accountId}/campaigns/${campaignPlatformId}`,
                type: "SEARCH_STANDARD",
                status: "ENABLED",
                cpcBidMicros: adGroup.bidAmount
                  ? Math.round(adGroup.bidAmount * 1_000_000).toString()
                  : undefined,
              },
            },
          ],
        }),
      }
    )) as { results: Array<{ resourceName: string }> };

    const resourceName = result.results[0].resourceName;
    const adGroupId = resourceName.split("/").pop() || resourceName;

    // Add keywords if specified
    if (adGroup.targeting.keywords?.length) {
      await googleFetch(
        `/customers/${credentials.accountId}/adGroupCriteria:mutate`,
        credentials,
        {
          method: "POST",
          body: JSON.stringify({
            operations: adGroup.targeting.keywords.map((keyword) => ({
              create: {
                adGroup: resourceName,
                keyword: {
                  text: keyword,
                  matchType: "BROAD",
                },
                status: "ENABLED",
              },
            })),
          }),
        }
      );
    }

    return { platformId: adGroupId, status: "ENABLED" };
  },

  async updateAdGroup(
    credentials: AdCredentials,
    platformId: string,
    updates: Partial<AdGroupSpec>
  ): Promise<PlatformAdGroupResult> {
    const updateFields: Record<string, unknown> = {
      resourceName: `customers/${credentials.accountId}/adGroups/${platformId}`,
    };
    const updateMask: string[] = [];

    if (updates.name) {
      updateFields.name = updates.name;
      updateMask.push("name");
    }

    if (updateMask.length > 0) {
      await googleFetch(
        `/customers/${credentials.accountId}/adGroups:mutate`,
        credentials,
        {
          method: "POST",
          body: JSON.stringify({
            operations: [{ update: updateFields, updateMask: updateMask.join(",") }],
          }),
        }
      );
    }

    return { platformId, status: "ENABLED" };
  },

  async createAd(
    credentials: AdCredentials,
    adGroupPlatformId: string,
    ad: AdSpec
  ): Promise<PlatformAdResult> {
    const result = (await googleFetch(
      `/customers/${credentials.accountId}/adGroupAds:mutate`,
      credentials,
      {
        method: "POST",
        body: JSON.stringify({
          operations: [
            {
              create: {
                adGroup: `customers/${credentials.accountId}/adGroups/${adGroupPlatformId}`,
                status: "ENABLED",
                ad: {
                  responsiveSearchAd: {
                    headlines: [
                      { text: ad.headline, pinnedField: "HEADLINE_1" },
                      ...(ad.descriptions?.slice(0, 2).map((d) => ({ text: d })) || []),
                    ],
                    descriptions: [
                      { text: ad.body },
                      ...(ad.descriptions?.slice(2).map((d) => ({ text: d })) || []),
                    ],
                  },
                  finalUrls: [ad.destinationUrl],
                },
              },
            },
          ],
        }),
      }
    )) as { results: Array<{ resourceName: string }> };

    const resourceName = result.results[0].resourceName;
    const adId = resourceName.split("/").pop() || resourceName;

    return {
      platformId: adId,
      status: "ENABLED",
      reviewStatus: "UNDER_REVIEW",
    };
  },

  async getPerformance(
    credentials: AdCredentials,
    campaignPlatformIds: string[],
    dateRange: DateRange
  ): Promise<PerformanceData[]> {
    const campaignFilter = campaignPlatformIds
      .map((id) => `'customers/${credentials.accountId}/campaigns/${id}'`)
      .join(", ");

    const query = `
      SELECT
        campaign.id,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros,
        metrics.conversions_value,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign
      WHERE campaign.resource_name IN (${campaignFilter})
        AND segments.date BETWEEN '${dateRange.start}' AND '${dateRange.end}'
      ORDER BY segments.date
    `;

    const data = (await googleFetch(
      `/customers/${credentials.accountId}/googleAds:searchStream`,
      credentials,
      {
        method: "POST",
        body: JSON.stringify({ query }),
      }
    )) as Array<{
      results: Array<{
        campaign: { id: string };
        segments: { date: string };
        metrics: {
          impressions: string;
          clicks: string;
          conversions: number;
          costMicros: string;
          conversionsValue: number;
          ctr: number;
          averageCpc: string;
        };
      }>;
    }>;

    const results: PerformanceData[] = [];

    for (const batch of data) {
      for (const row of batch.results) {
        const spend = parseInt(row.metrics.costMicros, 10) / 1_000_000;
        const conversions = row.metrics.conversions || 0;
        const revenue = row.metrics.conversionsValue || 0;

        results.push({
          campaignPlatformId: row.campaign.id,
          date: row.segments.date,
          impressions: parseInt(row.metrics.impressions, 10) || 0,
          clicks: parseInt(row.metrics.clicks, 10) || 0,
          conversions,
          spend,
          revenue,
          ctr: row.metrics.ctr || 0,
          cpc: parseInt(row.metrics.averageCpc, 10) / 1_000_000 || 0,
          cpa: conversions > 0 ? spend / conversions : null,
          roas: spend > 0 ? revenue / spend : null,
        });
      }
    }

    return results;
  },

  async updateBudget(
    credentials: AdCredentials,
    campaignPlatformId: string,
    dailyBudget: number
  ): Promise<void> {
    // First get the campaign's budget resource name
    const query = `
      SELECT campaign.campaign_budget
      FROM campaign
      WHERE campaign.id = ${campaignPlatformId}
    `;

    const data = (await googleFetch(
      `/customers/${credentials.accountId}/googleAds:search`,
      credentials,
      {
        method: "POST",
        body: JSON.stringify({ query }),
      }
    )) as {
      results: Array<{ campaign: { campaignBudget: string } }>;
    };

    const budgetResource = data.results[0]?.campaign.campaignBudget;
    if (!budgetResource) throw new Error("Campaign budget not found");

    await googleFetch(
      `/customers/${credentials.accountId}/campaignBudgets:mutate`,
      credentials,
      {
        method: "POST",
        body: JSON.stringify({
          operations: [
            {
              update: {
                resourceName: budgetResource,
                amountMicros: Math.round(dailyBudget * 1_000_000).toString(),
              },
              updateMask: "amount_micros",
            },
          ],
        }),
      }
    );
  },
};
