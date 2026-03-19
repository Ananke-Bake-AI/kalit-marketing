/**
 * Reddit Ads API Execution Adapter
 *
 * Translates canonical campaign models into Reddit Ads API calls.
 * Handles: campaigns, ad groups, ads, performance retrieval, budget updates.
 *
 * API Reference: https://ads-api.reddit.com/docs/
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

const REDDIT_API_BASE = "https://ads-api.reddit.com/api/v3/";

// Map canonical objectives to Reddit objectives
const objectiveMap: Record<CampaignObjective, string> = {
  awareness: "BRAND_AWARENESS",
  traffic: "WEBSITE_TRAFFIC",
  engagement: "ENGAGEMENT",
  leads: "CONVERSIONS",
  conversions: "CONVERSIONS",
  sales: "CONVERSIONS",
};

async function redditFetch(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<unknown> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${REDDIT_API_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (res.status === 204) return {};

  const data = await res.json();

  if (!res.ok) {
    const msg =
      (data as { message?: string }).message ||
      (data as { error?: string }).error;
    throw new Error(`Reddit Ads API error: ${msg || res.statusText}`);
  }

  return data;
}

export const redditAdapter: ChannelAdapter = {
  platform: "reddit",

  async validateCredentials(credentials: AdCredentials): Promise<boolean> {
    try {
      await redditFetch(
        `accounts/${credentials.accountId}`,
        credentials.accessToken
      );
      return true;
    } catch {
      return false;
    }
  },

  async getAccountInfo(credentials: AdCredentials): Promise<AccountInfo> {
    const data = (await redditFetch(
      `accounts/${credentials.accountId}`,
      credentials.accessToken
    )) as {
      data: {
        id: string;
        name: string;
        currency: string;
        time_zone: string;
        status: string;
      };
    };

    const account = data.data;
    return {
      id: account.id,
      name: account.name,
      currency: account.currency,
      timezone: account.time_zone,
      status: account.status === "ACTIVE" ? "active" : account.status.toLowerCase(),
    };
  },

  async createCampaign(
    credentials: AdCredentials,
    campaign: CampaignSpec
  ): Promise<PlatformCampaignResult> {
    const body: Record<string, unknown> = {
      account_id: credentials.accountId,
      name: campaign.name,
      objective: objectiveMap[campaign.objective] || "WEBSITE_TRAFFIC",
      is_paid: true,
      configured_status: campaign.status === "paused" ? "PAUSED" : "ACTIVE",
      daily_budget_micro: Math.round(campaign.dailyBudget * 1_000_000),
    };

    if (campaign.startDate) body.start_time = campaign.startDate;
    if (campaign.endDate) body.end_time = campaign.endDate;

    const data = (await redditFetch(
      `campaigns`,
      credentials.accessToken,
      { method: "POST", body: JSON.stringify(body) }
    )) as { data: { id: string; configured_status: string } };

    return {
      platformId: data.data.id,
      status: data.data.configured_status,
      effectiveDailyBudget: campaign.dailyBudget,
    };
  },

  async updateCampaign(
    credentials: AdCredentials,
    platformId: string,
    updates: Partial<CampaignSpec>
  ): Promise<PlatformCampaignResult> {
    const body: Record<string, unknown> = {};
    if (updates.name) body.name = updates.name;
    if (updates.dailyBudget)
      body.daily_budget_micro = Math.round(updates.dailyBudget * 1_000_000);
    if (updates.status)
      body.configured_status = updates.status === "paused" ? "PAUSED" : "ACTIVE";

    await redditFetch(
      `campaigns/${platformId}`,
      credentials.accessToken,
      { method: "PUT", body: JSON.stringify(body) }
    );

    return {
      platformId,
      status: updates.status === "paused" ? "PAUSED" : "ACTIVE",
      effectiveDailyBudget: updates.dailyBudget,
    };
  },

  async pauseCampaign(
    credentials: AdCredentials,
    platformId: string
  ): Promise<void> {
    await redditFetch(
      `campaigns/${platformId}`,
      credentials.accessToken,
      {
        method: "PUT",
        body: JSON.stringify({ configured_status: "PAUSED" }),
      }
    );
  },

  async resumeCampaign(
    credentials: AdCredentials,
    platformId: string
  ): Promise<void> {
    await redditFetch(
      `campaigns/${platformId}`,
      credentials.accessToken,
      {
        method: "PUT",
        body: JSON.stringify({ configured_status: "ACTIVE" }),
      }
    );
  },

  async removeCampaign(
    credentials: AdCredentials,
    platformId: string
  ): Promise<void> {
    await redditFetch(
      `campaigns/${platformId}`,
      credentials.accessToken,
      { method: "DELETE" }
    );
  },

  async createAdGroup(
    credentials: AdCredentials,
    campaignPlatformId: string,
    adGroup: AdGroupSpec
  ): Promise<PlatformAdGroupResult> {
    const body: Record<string, unknown> = {
      campaign_id: campaignPlatformId,
      name: adGroup.name,
      configured_status: "ACTIVE",
      bid_strategy: adGroup.bidStrategy || "AUTO",
      goal_type: "CLICKS",
      expand_targeting: true,
    };

    if (adGroup.dailyBudget) {
      body.daily_budget_micro = Math.round(adGroup.dailyBudget * 1_000_000);
    }
    if (adGroup.bidAmount) {
      body.bid_micro = Math.round(adGroup.bidAmount * 1_000_000);
      body.bid_strategy = "MANUAL";
    }

    // Targeting
    const targeting: Record<string, unknown> = {};

    if (adGroup.targeting.locations?.length) {
      targeting.geo = {
        include: adGroup.targeting.locations.map((loc) => ({
          country: loc,
        })),
      };
    }

    if (adGroup.targeting.interests?.length) {
      targeting.interests = {
        include: adGroup.targeting.interests,
      };
    }

    if (adGroup.targeting.devices?.length) {
      targeting.devices = adGroup.targeting.devices;
    }

    if (adGroup.targeting.ageMin || adGroup.targeting.ageMax) {
      const ageRanges: string[] = [];
      const min = adGroup.targeting.ageMin || 18;
      const max = adGroup.targeting.ageMax || 65;
      if (min <= 24 && max >= 18) ageRanges.push("18-24");
      if (min <= 34 && max >= 25) ageRanges.push("25-34");
      if (min <= 44 && max >= 35) ageRanges.push("35-44");
      if (min <= 54 && max >= 45) ageRanges.push("45-54");
      if (max >= 55) ageRanges.push("55+");
      targeting.age_ranges = ageRanges;
    }

    if (adGroup.targeting.genders?.length) {
      const gender = adGroup.targeting.genders[0];
      if (gender !== "all") {
        targeting.gender = gender === "male" ? "MALE" : "FEMALE";
      }
    }

    if (Object.keys(targeting).length > 0) {
      body.targeting = targeting;
    }

    const data = (await redditFetch(
      "adgroups",
      credentials.accessToken,
      { method: "POST", body: JSON.stringify(body) }
    )) as { data: { id: string } };

    return { platformId: data.data.id, status: "ACTIVE" };
  },

  async updateAdGroup(
    credentials: AdCredentials,
    platformId: string,
    updates: Partial<AdGroupSpec>
  ): Promise<PlatformAdGroupResult> {
    const body: Record<string, unknown> = {};
    if (updates.name) body.name = updates.name;
    if (updates.dailyBudget)
      body.daily_budget_micro = Math.round(updates.dailyBudget * 1_000_000);

    await redditFetch(
      `adgroups/${platformId}`,
      credentials.accessToken,
      { method: "PUT", body: JSON.stringify(body) }
    );

    return { platformId, status: "ACTIVE" };
  },

  async createAd(
    credentials: AdCredentials,
    adGroupPlatformId: string,
    ad: AdSpec
  ): Promise<PlatformAdResult> {
    const body: Record<string, unknown> = {
      adgroup_id: adGroupPlatformId,
      name: ad.name,
      headline: ad.headline,
      body: ad.body,
      click_url: ad.destinationUrl,
      call_to_action: ad.callToAction.toUpperCase().replace(/\s+/g, "_"),
      configured_status: "ACTIVE",
      post_type: "LINK",
    };

    if (ad.imageUrl) {
      body.thumbnail_url = ad.imageUrl;
    }
    if (ad.videoUrl) {
      body.video_url = ad.videoUrl;
      body.post_type = "VIDEO";
    }

    const data = (await redditFetch(
      "ads",
      credentials.accessToken,
      { method: "POST", body: JSON.stringify(body) }
    )) as { data: { id: string; review_status: string } };

    return {
      platformId: data.data.id,
      status: "ACTIVE",
      reviewStatus: data.data.review_status || "PENDING",
    };
  },

  async getPerformance(
    credentials: AdCredentials,
    campaignPlatformIds: string[],
    dateRange: DateRange
  ): Promise<PerformanceData[]> {
    const results: PerformanceData[] = [];

    const data = (await redditFetch(
      "reporting",
      credentials.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          account_id: credentials.accountId,
          starts_at: `${dateRange.start}T00:00:00Z`,
          ends_at: `${dateRange.end}T23:59:59Z`,
          group_by: ["campaign_id", "date"],
          fields: [
            "impressions",
            "clicks",
            "conversions",
            "spend",
            "ecpc",
          ],
          filters: [
            {
              field: "campaign_id",
              operator: "IN",
              values: campaignPlatformIds,
            },
          ],
        }),
      }
    )) as {
      data?: Array<{
        campaign_id: string;
        date: string;
        impressions: number;
        clicks: number;
        conversions: number;
        spend: number;
      }>;
    };

    if (data.data) {
      for (const row of data.data) {
        const impressions = row.impressions || 0;
        const clicks = row.clicks || 0;
        const conversions = row.conversions || 0;
        const spend = (row.spend || 0) / 1_000_000; // micro-dollars to dollars
        const revenue = 0; // Reddit doesn't return revenue directly

        results.push({
          campaignPlatformId: row.campaign_id,
          date: row.date,
          impressions,
          clicks,
          conversions,
          spend,
          revenue,
          ctr: impressions > 0 ? clicks / impressions : 0,
          cpc: clicks > 0 ? spend / clicks : 0,
          cpa: conversions > 0 ? spend / conversions : null,
          roas: null,
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
    await redditFetch(
      `campaigns/${campaignPlatformId}`,
      credentials.accessToken,
      {
        method: "PUT",
        body: JSON.stringify({
          daily_budget_micro: Math.round(dailyBudget * 1_000_000),
        }),
      }
    );
  },
};
