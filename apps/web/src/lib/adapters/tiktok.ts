/**
 * TikTok Marketing API Execution Adapter
 *
 * Translates canonical campaign models into TikTok Marketing API calls.
 * Handles: campaigns, ad groups, ads, performance retrieval, budget updates.
 *
 * API Reference: https://business-api.tiktok.com/portal/docs
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

const TIKTOK_API_BASE = "https://business-api.tiktok.com/open_api/v1.3/";

// Map canonical objectives to TikTok objectives
const objectiveMap: Record<CampaignObjective, string> = {
  awareness: "REACH",
  traffic: "TRAFFIC",
  engagement: "VIDEO_VIEWS",
  leads: "LEAD_GENERATION",
  conversions: "CONVERSIONS",
  sales: "CATALOG_SALES",
};

async function tiktokFetch(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<unknown> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${TIKTOK_API_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Access-Token": token,
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = (data as { message?: string }).message;
    throw new Error(`TikTok API error: ${msg || res.statusText}`);
  }

  const body = data as { code?: number; message?: string; data?: unknown };
  if (body.code && body.code !== 0) {
    throw new Error(`TikTok API error: ${body.message || "Unknown error"}`);
  }

  return body.data ?? data;
}

export const tiktokAdapter: ChannelAdapter = {
  platform: "tiktok",

  async validateCredentials(credentials: AdCredentials): Promise<boolean> {
    try {
      await tiktokFetch(
        `advertiser/info/?advertiser_ids=["${credentials.accountId}"]`,
        credentials.accessToken
      );
      return true;
    } catch {
      return false;
    }
  },

  async getAccountInfo(credentials: AdCredentials): Promise<AccountInfo> {
    const data = (await tiktokFetch(
      `advertiser/info/?advertiser_ids=["${credentials.accountId}"]`,
      credentials.accessToken
    )) as {
      list: Array<{
        advertiser_id: string;
        advertiser_name: string;
        currency: string;
        timezone: string;
        status: string;
      }>;
    };

    const account = data.list[0];
    return {
      id: account.advertiser_id,
      name: account.advertiser_name,
      currency: account.currency,
      timezone: account.timezone,
      status: account.status === "STATUS_ENABLE" ? "active" : account.status.toLowerCase(),
    };
  },

  async createCampaign(
    credentials: AdCredentials,
    campaign: CampaignSpec
  ): Promise<PlatformCampaignResult> {
    const data = (await tiktokFetch(
      "campaign/create/",
      credentials.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          advertiser_id: credentials.accountId,
          campaign_name: campaign.name,
          objective_type: objectiveMap[campaign.objective] || "TRAFFIC",
          budget_mode: "BUDGET_MODE_DAY",
          budget: campaign.dailyBudget, // TikTok uses dollars, not cents
          operation_status: campaign.status === "paused" ? "DISABLE" : "ENABLE",
        }),
      }
    )) as { campaign_id: string };

    return {
      platformId: data.campaign_id,
      status: campaign.status === "paused" ? "DISABLE" : "ENABLE",
      effectiveDailyBudget: campaign.dailyBudget,
    };
  },

  async updateCampaign(
    credentials: AdCredentials,
    platformId: string,
    updates: Partial<CampaignSpec>
  ): Promise<PlatformCampaignResult> {
    const body: Record<string, unknown> = {
      advertiser_id: credentials.accountId,
      campaign_id: platformId,
    };
    if (updates.name) body.campaign_name = updates.name;
    if (updates.dailyBudget) body.budget = updates.dailyBudget;
    if (updates.status)
      body.operation_status = updates.status === "paused" ? "DISABLE" : "ENABLE";

    await tiktokFetch("campaign/update/", credentials.accessToken, {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      platformId,
      status: updates.status === "paused" ? "DISABLE" : "ENABLE",
      effectiveDailyBudget: updates.dailyBudget,
    };
  },

  async pauseCampaign(
    credentials: AdCredentials,
    platformId: string
  ): Promise<void> {
    await tiktokFetch("campaign/status/update/", credentials.accessToken, {
      method: "POST",
      body: JSON.stringify({
        advertiser_id: credentials.accountId,
        campaign_ids: [platformId],
        operation_status: "DISABLE",
      }),
    });
  },

  async resumeCampaign(
    credentials: AdCredentials,
    platformId: string
  ): Promise<void> {
    await tiktokFetch("campaign/status/update/", credentials.accessToken, {
      method: "POST",
      body: JSON.stringify({
        advertiser_id: credentials.accountId,
        campaign_ids: [platformId],
        operation_status: "ENABLE",
      }),
    });
  },

  async removeCampaign(
    credentials: AdCredentials,
    platformId: string
  ): Promise<void> {
    await tiktokFetch("campaign/status/update/", credentials.accessToken, {
      method: "POST",
      body: JSON.stringify({
        advertiser_id: credentials.accountId,
        campaign_ids: [platformId],
        operation_status: "DELETE",
      }),
    });
  },

  async createAdGroup(
    credentials: AdCredentials,
    campaignPlatformId: string,
    adGroup: AdGroupSpec
  ): Promise<PlatformAdGroupResult> {
    const body: Record<string, unknown> = {
      advertiser_id: credentials.accountId,
      campaign_id: campaignPlatformId,
      adgroup_name: adGroup.name,
      placement_type: "PLACEMENT_TYPE_AUTOMATIC",
      billing_event: "CPC",
      optimization_goal: "CLICK",
      operation_status: "ENABLE",
    };

    if (adGroup.dailyBudget) {
      body.budget_mode = "BUDGET_MODE_DAY";
      body.budget = adGroup.dailyBudget;
    }
    if (adGroup.bidAmount) {
      body.bid_price = adGroup.bidAmount;
    }

    // Targeting
    const location: string[] = [];
    if (adGroup.targeting.locations?.length) {
      location.push(...adGroup.targeting.locations);
    }
    body.location_ids = location;

    if (adGroup.targeting.ageMin || adGroup.targeting.ageMax) {
      const ageGroups: string[] = [];
      const min = adGroup.targeting.ageMin || 13;
      const max = adGroup.targeting.ageMax || 65;
      if (min <= 17 && max >= 13) ageGroups.push("AGE_13_17");
      if (min <= 24 && max >= 18) ageGroups.push("AGE_18_24");
      if (min <= 34 && max >= 25) ageGroups.push("AGE_25_34");
      if (min <= 44 && max >= 35) ageGroups.push("AGE_35_44");
      if (min <= 54 && max >= 45) ageGroups.push("AGE_45_54");
      if (max >= 55) ageGroups.push("AGE_55_100");
      body.age_groups = ageGroups;
    }

    if (adGroup.targeting.genders?.length) {
      const gender = adGroup.targeting.genders[0];
      body.gender = gender === "male" ? "GENDER_MALE" : gender === "female" ? "GENDER_FEMALE" : "GENDER_UNLIMITED";
    }

    if (adGroup.targeting.interests?.length) {
      body.interest_keyword_ids = adGroup.targeting.interests;
    }

    if (adGroup.targeting.languages?.length) {
      body.languages = adGroup.targeting.languages;
    }

    const data = (await tiktokFetch(
      "adgroup/create/",
      credentials.accessToken,
      { method: "POST", body: JSON.stringify(body) }
    )) as { adgroup_id: string };

    return { platformId: data.adgroup_id, status: "ENABLE" };
  },

  async updateAdGroup(
    credentials: AdCredentials,
    platformId: string,
    updates: Partial<AdGroupSpec>
  ): Promise<PlatformAdGroupResult> {
    const body: Record<string, unknown> = {
      advertiser_id: credentials.accountId,
      adgroup_id: platformId,
    };
    if (updates.name) body.adgroup_name = updates.name;
    if (updates.dailyBudget) body.budget = updates.dailyBudget;

    await tiktokFetch("adgroup/update/", credentials.accessToken, {
      method: "POST",
      body: JSON.stringify(body),
    });

    return { platformId, status: "ENABLE" };
  },

  async createAd(
    credentials: AdCredentials,
    adGroupPlatformId: string,
    ad: AdSpec
  ): Promise<PlatformAdResult> {
    const body: Record<string, unknown> = {
      advertiser_id: credentials.accountId,
      adgroup_id: adGroupPlatformId,
      ad_name: ad.name,
      ad_text: ad.body,
      call_to_action: ad.callToAction.toUpperCase().replace(/\s+/g, "_"),
      landing_page_url: ad.destinationUrl,
      display_name: ad.headline,
    };

    if (ad.imageUrl) {
      body.image_ids = [ad.imageUrl];
    }
    if (ad.videoUrl) {
      body.video_id = ad.videoUrl;
    }

    const data = (await tiktokFetch(
      "ad/create/",
      credentials.accessToken,
      { method: "POST", body: JSON.stringify(body) }
    )) as { ad_id: string };

    return {
      platformId: data.ad_id,
      status: "ENABLE",
      reviewStatus: "PENDING",
    };
  },

  async getPerformance(
    credentials: AdCredentials,
    campaignPlatformIds: string[],
    dateRange: DateRange
  ): Promise<PerformanceData[]> {
    const results: PerformanceData[] = [];

    const data = (await tiktokFetch(
      "report/integrated/get/",
      credentials.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          advertiser_id: credentials.accountId,
          report_type: "BASIC",
          data_level: "AUCTION_CAMPAIGN",
          dimensions: ["campaign_id", "stat_time_day"],
          metrics: [
            "impressions",
            "clicks",
            "conversions",
            "spend",
            "conversion_rate",
            "ctr",
            "cpc",
            "cost_per_conversion",
            "total_complete_payment_rate",
          ],
          start_date: dateRange.start,
          end_date: dateRange.end,
          filtering: [
            {
              field_name: "campaign_ids",
              filter_type: "IN",
              filter_value: JSON.stringify(campaignPlatformIds),
            },
          ],
          page_size: 1000,
        }),
      }
    )) as {
      list?: Array<{
        dimensions: { campaign_id: string; stat_time_day: string };
        metrics: Record<string, string>;
      }>;
    };

    if (data.list) {
      for (const row of data.list) {
        const impressions = parseInt(row.metrics.impressions, 10) || 0;
        const clicks = parseInt(row.metrics.clicks, 10) || 0;
        const conversions = parseInt(row.metrics.conversions, 10) || 0;
        const spend = parseFloat(row.metrics.spend) || 0;
        const revenue = parseFloat(row.metrics.total_complete_payment_rate) || 0;

        results.push({
          campaignPlatformId: row.dimensions.campaign_id,
          date: row.dimensions.stat_time_day,
          impressions,
          clicks,
          conversions,
          spend,
          revenue,
          ctr: impressions > 0 ? clicks / impressions : 0,
          cpc: clicks > 0 ? spend / clicks : 0,
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
    await tiktokFetch("campaign/update/", credentials.accessToken, {
      method: "POST",
      body: JSON.stringify({
        advertiser_id: credentials.accountId,
        campaign_id: campaignPlatformId,
        budget: dailyBudget,
      }),
    });
  },
};
