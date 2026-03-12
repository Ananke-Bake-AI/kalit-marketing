/**
 * Meta (Facebook/Instagram) Ads Execution Adapter
 *
 * Translates canonical campaign models into Meta Marketing API calls.
 * Handles: campaigns, ad sets, ads, performance retrieval, budget updates.
 *
 * API Reference: https://developers.facebook.com/docs/marketing-apis
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

const META_API_VERSION = "v21.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// Map canonical objectives to Meta objectives
const objectiveMap: Record<CampaignObjective, string> = {
  awareness: "OUTCOME_AWARENESS",
  traffic: "OUTCOME_TRAFFIC",
  engagement: "OUTCOME_ENGAGEMENT",
  leads: "OUTCOME_LEADS",
  conversions: "OUTCOME_SALES",
  sales: "OUTCOME_SALES",
};

async function metaFetch(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<unknown> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${META_API_BASE}${endpoint}`;

  const separator = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${separator}access_token=${token}`;

  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const error = (data as { error?: { message?: string } }).error;
    throw new Error(
      `Meta API error: ${error?.message || res.statusText}`
    );
  }

  return data;
}

export const metaAdapter: ChannelAdapter = {
  platform: "meta",

  async validateCredentials(credentials: AdCredentials): Promise<boolean> {
    try {
      await metaFetch(
        `/act_${credentials.accountId}?fields=name,account_status`,
        credentials.accessToken
      );
      return true;
    } catch {
      return false;
    }
  },

  async getAccountInfo(credentials: AdCredentials): Promise<AccountInfo> {
    const data = (await metaFetch(
      `/act_${credentials.accountId}?fields=name,currency,timezone_name,account_status`,
      credentials.accessToken
    )) as {
      id: string;
      name: string;
      currency: string;
      timezone_name: string;
      account_status: number;
    };

    const statusMap: Record<number, string> = {
      1: "active",
      2: "disabled",
      3: "unsettled",
      7: "pending_risk_review",
      9: "in_grace_period",
      100: "pending_closure",
      101: "closed",
    };

    return {
      id: data.id,
      name: data.name,
      currency: data.currency,
      timezone: data.timezone_name,
      status: statusMap[data.account_status] || "unknown",
    };
  },

  async createCampaign(
    credentials: AdCredentials,
    campaign: CampaignSpec
  ): Promise<PlatformCampaignResult> {
    const data = (await metaFetch(
      `/act_${credentials.accountId}/campaigns`,
      credentials.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          name: campaign.name,
          objective: objectiveMap[campaign.objective] || "OUTCOME_TRAFFIC",
          status: campaign.status === "paused" ? "PAUSED" : "ACTIVE",
          special_ad_categories: [],
          daily_budget: Math.round(campaign.dailyBudget * 100), // Meta uses cents
        }),
      }
    )) as { id: string };

    return {
      platformId: data.id,
      status: campaign.status === "paused" ? "PAUSED" : "ACTIVE",
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
      body.daily_budget = Math.round(updates.dailyBudget * 100);
    if (updates.status)
      body.status = updates.status === "paused" ? "PAUSED" : "ACTIVE";

    await metaFetch(`/${platformId}`, credentials.accessToken, {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      platformId,
      status: (updates.status === "paused" ? "PAUSED" : "ACTIVE"),
      effectiveDailyBudget: updates.dailyBudget,
    };
  },

  async pauseCampaign(
    credentials: AdCredentials,
    platformId: string
  ): Promise<void> {
    await metaFetch(`/${platformId}`, credentials.accessToken, {
      method: "POST",
      body: JSON.stringify({ status: "PAUSED" }),
    });
  },

  async resumeCampaign(
    credentials: AdCredentials,
    platformId: string
  ): Promise<void> {
    await metaFetch(`/${platformId}`, credentials.accessToken, {
      method: "POST",
      body: JSON.stringify({ status: "ACTIVE" }),
    });
  },

  async createAdGroup(
    credentials: AdCredentials,
    campaignPlatformId: string,
    adGroup: AdGroupSpec
  ): Promise<PlatformAdGroupResult> {
    const targeting: Record<string, unknown> = {};

    if (adGroup.targeting.ageMin) targeting.age_min = adGroup.targeting.ageMin;
    if (adGroup.targeting.ageMax) targeting.age_max = adGroup.targeting.ageMax;
    if (adGroup.targeting.genders?.length) {
      targeting.genders = adGroup.targeting.genders.map((g) =>
        g === "male" ? 1 : g === "female" ? 2 : 0
      );
    }
    if (adGroup.targeting.locations?.length) {
      targeting.geo_locations = {
        countries: adGroup.targeting.locations,
      };
    }
    if (adGroup.targeting.interests?.length) {
      targeting.flexible_spec = [
        {
          interests: adGroup.targeting.interests.map((i) => ({
            name: i,
          })),
        },
      ];
    }

    const body: Record<string, unknown> = {
      campaign_id: campaignPlatformId,
      name: adGroup.name,
      targeting,
      billing_event: "IMPRESSIONS",
      optimization_goal: "LINK_CLICKS",
      status: "ACTIVE",
    };

    if (adGroup.dailyBudget) {
      body.daily_budget = Math.round(adGroup.dailyBudget * 100);
    }
    if (adGroup.bidAmount) {
      body.bid_amount = Math.round(adGroup.bidAmount * 100);
    }

    const data = (await metaFetch(
      `/act_${credentials.accountId}/adsets`,
      credentials.accessToken,
      { method: "POST", body: JSON.stringify(body) }
    )) as { id: string };

    return { platformId: data.id, status: "ACTIVE" };
  },

  async updateAdGroup(
    credentials: AdCredentials,
    platformId: string,
    updates: Partial<AdGroupSpec>
  ): Promise<PlatformAdGroupResult> {
    const body: Record<string, unknown> = {};
    if (updates.name) body.name = updates.name;
    if (updates.dailyBudget)
      body.daily_budget = Math.round(updates.dailyBudget * 100);

    await metaFetch(`/${platformId}`, credentials.accessToken, {
      method: "POST",
      body: JSON.stringify(body),
    });

    return { platformId, status: "ACTIVE" };
  },

  async createAd(
    credentials: AdCredentials,
    adGroupPlatformId: string,
    ad: AdSpec
  ): Promise<PlatformAdResult> {
    // First create the ad creative
    const creativeBody: Record<string, unknown> = {
      name: ad.name,
      object_story_spec: {
        link_data: {
          message: ad.body,
          link: ad.destinationUrl,
          name: ad.headline,
          call_to_action: {
            type: ad.callToAction.toUpperCase().replace(/\s+/g, "_"),
            value: { link: ad.destinationUrl },
          },
        },
      },
    };

    if (ad.imageUrl) {
      (
        creativeBody.object_story_spec as Record<string, unknown>
      ).link_data = {
        ...(creativeBody.object_story_spec as Record<string, Record<string, unknown>>).link_data,
        picture: ad.imageUrl,
      };
    }

    const creative = (await metaFetch(
      `/act_${credentials.accountId}/adcreatives`,
      credentials.accessToken,
      { method: "POST", body: JSON.stringify(creativeBody) }
    )) as { id: string };

    // Then create the ad
    const adData = (await metaFetch(
      `/act_${credentials.accountId}/ads`,
      credentials.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          name: ad.name,
          adset_id: adGroupPlatformId,
          creative: { creative_id: creative.id },
          status: "ACTIVE",
        }),
      }
    )) as { id: string };

    return {
      platformId: adData.id,
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

    for (const campaignId of campaignPlatformIds) {
      const data = (await metaFetch(
        `/${campaignId}/insights?fields=impressions,clicks,actions,spend,action_values&time_range={"since":"${dateRange.start}","until":"${dateRange.end}"}&time_increment=1`,
        credentials.accessToken
      )) as { data?: Array<Record<string, unknown>> };

      if (data.data) {
        for (const row of data.data) {
          const actions = (row.actions as Array<{ action_type: string; value: string }>) || [];
          const actionValues = (row.action_values as Array<{ action_type: string; value: string }>) || [];

          const conversions = actions
            .filter(
              (a) =>
                a.action_type === "offsite_conversion" ||
                a.action_type === "lead" ||
                a.action_type === "purchase"
            )
            .reduce((sum, a) => sum + parseInt(a.value, 10), 0);

          const revenue = actionValues
            .filter((a) => a.action_type === "purchase")
            .reduce((sum, a) => sum + parseFloat(a.value), 0);

          const impressions = parseInt(row.impressions as string, 10) || 0;
          const clicks = parseInt(row.clicks as string, 10) || 0;
          const spend = parseFloat(row.spend as string) || 0;

          results.push({
            campaignPlatformId: campaignId,
            date: row.date_start as string,
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
    await metaFetch(`/${campaignPlatformId}`, credentials.accessToken, {
      method: "POST",
      body: JSON.stringify({
        daily_budget: Math.round(dailyBudget * 100),
      }),
    });
  },
};
