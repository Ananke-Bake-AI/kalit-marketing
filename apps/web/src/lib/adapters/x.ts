/**
 * X (Twitter) Ads API Execution Adapter
 *
 * Translates canonical campaign models into X Ads API calls.
 * Handles: campaigns, line items (ad groups), promoted tweets (ads),
 * performance retrieval, budget updates.
 *
 * API Reference: https://developer.x.com/en/docs/x-ads-api
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

const X_API_BASE = "https://ads-api.x.com/12/";

// Map canonical objectives to X objectives
const objectiveMap: Record<CampaignObjective, string> = {
  awareness: "AWARENESS",
  traffic: "WEBSITE_CLICKS",
  engagement: "ENGAGEMENTS",
  leads: "WEBSITE_CONVERSIONS",
  conversions: "WEBSITE_CONVERSIONS",
  sales: "WEBSITE_CONVERSIONS",
};

async function xFetch(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<unknown> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${X_API_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const errors = (data as { errors?: Array<{ message?: string }> }).errors;
    const msg = errors?.[0]?.message || res.statusText;
    throw new Error(`X Ads API error: ${msg}`);
  }

  return data;
}

export const xAdapter: ChannelAdapter = {
  platform: "x",

  async validateCredentials(credentials: AdCredentials): Promise<boolean> {
    try {
      await xFetch(
        `accounts/${credentials.accountId}`,
        credentials.accessToken
      );
      return true;
    } catch {
      return false;
    }
  },

  async getAccountInfo(credentials: AdCredentials): Promise<AccountInfo> {
    const data = (await xFetch(
      `accounts/${credentials.accountId}`,
      credentials.accessToken
    )) as {
      data: {
        id: string;
        name: string;
        currency: string;
        timezone: string;
        approval_status: string;
      };
    };

    const account = data.data;
    return {
      id: account.id,
      name: account.name,
      currency: account.currency,
      timezone: account.timezone,
      status: account.approval_status === "ACCEPTED" ? "active" : account.approval_status.toLowerCase(),
    };
  },

  async createCampaign(
    credentials: AdCredentials,
    campaign: CampaignSpec
  ): Promise<PlatformCampaignResult> {
    const body: Record<string, unknown> = {
      name: campaign.name,
      funding_instrument_id: credentials.metadata?.fundingInstrumentId,
      objective: objectiveMap[campaign.objective] || "WEBSITE_CLICKS",
      entity_status: campaign.status === "paused" ? "PAUSED" : "ACTIVE",
      daily_budget_amount_local_micro: Math.round(campaign.dailyBudget * 1_000_000),
      standard_delivery: true,
    };

    if (campaign.startDate) body.start_time = campaign.startDate;
    if (campaign.endDate) body.end_time = campaign.endDate;

    const data = (await xFetch(
      `accounts/${credentials.accountId}/campaigns`,
      credentials.accessToken,
      { method: "POST", body: JSON.stringify(body) }
    )) as { data: { id: string; entity_status: string } };

    return {
      platformId: data.data.id,
      status: data.data.entity_status,
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
      body.daily_budget_amount_local_micro = Math.round(updates.dailyBudget * 1_000_000);
    if (updates.status)
      body.entity_status = updates.status === "paused" ? "PAUSED" : "ACTIVE";

    await xFetch(
      `accounts/${credentials.accountId}/campaigns/${platformId}`,
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
    await xFetch(
      `accounts/${credentials.accountId}/campaigns/${platformId}`,
      credentials.accessToken,
      {
        method: "PUT",
        body: JSON.stringify({ entity_status: "PAUSED" }),
      }
    );
  },

  async resumeCampaign(
    credentials: AdCredentials,
    platformId: string
  ): Promise<void> {
    await xFetch(
      `accounts/${credentials.accountId}/campaigns/${platformId}`,
      credentials.accessToken,
      {
        method: "PUT",
        body: JSON.stringify({ entity_status: "ACTIVE" }),
      }
    );
  },

  async removeCampaign(
    credentials: AdCredentials,
    platformId: string
  ): Promise<void> {
    await xFetch(
      `accounts/${credentials.accountId}/campaigns/${platformId}`,
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
      bid_type: "AUTO",
      placements: ["ALL_ON_TWITTER"],
      product_type: "PROMOTED_TWEETS",
      entity_status: "ACTIVE",
    };

    if (adGroup.dailyBudget) {
      body.bid_amount_local_micro = Math.round(adGroup.dailyBudget * 1_000_000);
    }
    if (adGroup.bidAmount) {
      body.bid_amount_local_micro = Math.round(adGroup.bidAmount * 1_000_000);
      body.bid_type = "MAX";
    }

    // Targeting criteria
    const targetingCriteria: Array<Record<string, unknown>> = [];

    if (adGroup.targeting.locations?.length) {
      for (const loc of adGroup.targeting.locations) {
        targetingCriteria.push({
          targeting_type: "LOCATION",
          targeting_value: loc,
        });
      }
    }

    if (adGroup.targeting.ageMin || adGroup.targeting.ageMax) {
      targetingCriteria.push({
        targeting_type: "AGE",
        targeting_value: `AGE_${adGroup.targeting.ageMin || 13}_TO_${adGroup.targeting.ageMax || 54}_AND_ABOVE`,
      });
    }

    if (adGroup.targeting.genders?.length) {
      const gender = adGroup.targeting.genders[0];
      if (gender !== "all") {
        targetingCriteria.push({
          targeting_type: "GENDER",
          targeting_value: gender === "male" ? "1" : "2",
        });
      }
    }

    if (adGroup.targeting.keywords?.length) {
      for (const keyword of adGroup.targeting.keywords) {
        targetingCriteria.push({
          targeting_type: "BROAD_KEYWORD",
          targeting_value: keyword,
        });
      }
    }

    if (adGroup.targeting.interests?.length) {
      for (const interest of adGroup.targeting.interests) {
        targetingCriteria.push({
          targeting_type: "INTEREST",
          targeting_value: interest,
        });
      }
    }

    if (adGroup.targeting.languages?.length) {
      for (const lang of adGroup.targeting.languages) {
        targetingCriteria.push({
          targeting_type: "LANGUAGE",
          targeting_value: lang,
        });
      }
    }

    if (adGroup.targeting.devices?.length) {
      for (const device of adGroup.targeting.devices) {
        targetingCriteria.push({
          targeting_type: "PLATFORM",
          targeting_value: device,
        });
      }
    }

    // Create line item first
    const lineItem = (await xFetch(
      `accounts/${credentials.accountId}/line_items`,
      credentials.accessToken,
      { method: "POST", body: JSON.stringify(body) }
    )) as { data: { id: string } };

    // Apply targeting criteria
    if (targetingCriteria.length > 0) {
      for (const criteria of targetingCriteria) {
        await xFetch(
          `accounts/${credentials.accountId}/targeting_criteria`,
          credentials.accessToken,
          {
            method: "POST",
            body: JSON.stringify({
              line_item_id: lineItem.data.id,
              ...criteria,
            }),
          }
        );
      }
    }

    return { platformId: lineItem.data.id, status: "ACTIVE" };
  },

  async updateAdGroup(
    credentials: AdCredentials,
    platformId: string,
    updates: Partial<AdGroupSpec>
  ): Promise<PlatformAdGroupResult> {
    const body: Record<string, unknown> = {};
    if (updates.name) body.name = updates.name;
    if (updates.dailyBudget)
      body.bid_amount_local_micro = Math.round(updates.dailyBudget * 1_000_000);

    await xFetch(
      `accounts/${credentials.accountId}/line_items/${platformId}`,
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
    // Create a tweet first (card-based ad)
    const tweetBody: Record<string, unknown> = {
      text: `${ad.headline}\n\n${ad.body}\n\n${ad.destinationUrl}`,
    };

    const tweet = (await xFetch(
      `accounts/${credentials.accountId}/tweet`,
      credentials.accessToken,
      { method: "POST", body: JSON.stringify(tweetBody) }
    )) as { data: { id: string; tweet_id: string } };

    const tweetId = tweet.data.tweet_id || tweet.data.id;

    // Create promoted tweet
    const data = (await xFetch(
      `accounts/${credentials.accountId}/promoted_tweets`,
      credentials.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          line_item_id: adGroupPlatformId,
          tweet_ids: [tweetId],
        }),
      }
    )) as { data: Array<{ id: string }> };

    return {
      platformId: data.data[0].id,
      status: "ACTIVE",
      reviewStatus: "PENDING",
    };
  },

  async getPerformance(
    credentials: AdCredentials,
    campaignPlatformIds: string[],
    dateRange: DateRange
  ): Promise<PerformanceData[]> {
    const results: PerformanceData[] = [];

    const data = (await xFetch(
      `stats/accounts/${credentials.accountId}?entity=CAMPAIGN&entity_ids=${campaignPlatformIds.join(",")}&start_time=${dateRange.start}T00:00:00Z&end_time=${dateRange.end}T23:59:59Z&granularity=DAY&metric_groups=ENGAGEMENT,BILLING,WEB_CONVERSION`,
      credentials.accessToken
    )) as {
      data: Array<{
        id: string;
        id_data: Array<{
          metrics: {
            impressions?: number[];
            clicks?: number[];
            billed_charge_local_micro?: number[];
            conversion_purchases?: Record<string, number[]>;
            conversion_sign_ups?: Record<string, number[]>;
          };
          segment?: { start_time: string };
        }>;
      }>;
    };

    if (data.data) {
      for (const entity of data.data) {
        for (const dayData of entity.id_data) {
          const impressions = dayData.metrics.impressions?.[0] || 0;
          const clicks = dayData.metrics.clicks?.[0] || 0;
          const spend = (dayData.metrics.billed_charge_local_micro?.[0] || 0) / 1_000_000;
          const conversions = 0; // X aggregates conversions differently
          const revenue = 0;

          results.push({
            campaignPlatformId: entity.id,
            date: dayData.segment?.start_time?.split("T")[0] || dateRange.start,
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
    }

    return results;
  },

  async updateBudget(
    credentials: AdCredentials,
    campaignPlatformId: string,
    dailyBudget: number
  ): Promise<void> {
    await xFetch(
      `accounts/${credentials.accountId}/campaigns/${campaignPlatformId}`,
      credentials.accessToken,
      {
        method: "PUT",
        body: JSON.stringify({
          daily_budget_amount_local_micro: Math.round(dailyBudget * 1_000_000),
        }),
      }
    );
  },
};
