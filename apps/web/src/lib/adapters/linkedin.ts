/**
 * LinkedIn Marketing API Execution Adapter
 *
 * Translates canonical campaign models into LinkedIn Marketing API calls.
 * Handles: campaign groups (campaigns), campaigns (ad groups), creatives (ads),
 * performance retrieval, budget updates.
 *
 * API Reference: https://learn.microsoft.com/en-us/linkedin/marketing/
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

const LINKEDIN_API_BASE = "https://api.linkedin.com/rest/";

// Map canonical objectives to LinkedIn objectives
const objectiveMap: Record<CampaignObjective, string> = {
  awareness: "BRAND_AWARENESS",
  traffic: "WEBSITE_VISITS",
  engagement: "ENGAGEMENT",
  leads: "LEAD_GENERATION",
  conversions: "WEBSITE_CONVERSIONS",
  sales: "WEBSITE_CONVERSIONS",
};

async function linkedinFetch(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<unknown> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${LINKEDIN_API_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": "202401",
      "X-Restli-Protocol-Version": "2.0.0",
      ...options.headers,
    },
  });

  if (res.status === 204) return {};

  const data = await res.json();

  if (!res.ok) {
    const msg = (data as { message?: string }).message;
    throw new Error(`LinkedIn API error: ${msg || res.statusText}`);
  }

  return data;
}

export const linkedinAdapter: ChannelAdapter = {
  platform: "linkedin",

  async validateCredentials(credentials: AdCredentials): Promise<boolean> {
    try {
      await linkedinFetch(
        `adAccountsV2/${credentials.accountId}`,
        credentials.accessToken
      );
      return true;
    } catch {
      return false;
    }
  },

  async getAccountInfo(credentials: AdCredentials): Promise<AccountInfo> {
    const data = (await linkedinFetch(
      `adAccountsV2/${credentials.accountId}`,
      credentials.accessToken
    )) as {
      id: number;
      name: string;
      currency: string;
      status: string;
    };

    return {
      id: String(data.id),
      name: data.name,
      currency: data.currency,
      timezone: "UTC", // LinkedIn accounts don't expose timezone directly
      status: data.status === "ACTIVE" ? "active" : data.status.toLowerCase(),
    };
  },

  async createCampaign(
    credentials: AdCredentials,
    campaign: CampaignSpec
  ): Promise<PlatformCampaignResult> {
    const body: Record<string, unknown> = {
      account: `urn:li:sponsoredAccount:${credentials.accountId}`,
      name: campaign.name,
      status: campaign.status === "paused" ? "PAUSED" : "ACTIVE",
      totalBudget: {
        amount: campaign.totalBudget
          ? String(Math.round(campaign.totalBudget * 100))
          : "0",
        currencyCode: campaign.currency,
      },
      dailyBudget: {
        amount: String(Math.round(campaign.dailyBudget * 100)), // LinkedIn uses cents
        currencyCode: campaign.currency,
      },
    };

    if (campaign.startDate) body.runSchedule = { start: campaign.startDate };
    if (campaign.endDate) {
      body.runSchedule = {
        ...(body.runSchedule as Record<string, unknown> || {}),
        end: campaign.endDate,
      };
    }

    const res = await fetch(`${LINKEDIN_API_BASE}adCampaignGroups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
        "LinkedIn-Version": "202401",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(
        `LinkedIn API error: ${(errData as { message?: string }).message || res.statusText}`
      );
    }

    // LinkedIn returns the ID in the x-restli-id header
    const platformId = res.headers.get("x-restli-id") || "";

    return {
      platformId,
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
    if (updates.dailyBudget) {
      body.dailyBudget = {
        amount: String(Math.round(updates.dailyBudget * 100)),
        currencyCode: updates.currency || "USD",
      };
    }
    if (updates.status)
      body.status = updates.status === "paused" ? "PAUSED" : "ACTIVE";

    await linkedinFetch(
      `adCampaignGroups/${platformId}`,
      credentials.accessToken,
      { method: "POST", body: JSON.stringify({ patch: { $set: body } }) }
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
    await linkedinFetch(
      `adCampaignGroups/${platformId}`,
      credentials.accessToken,
      {
        method: "POST",
        body: JSON.stringify({ patch: { $set: { status: "PAUSED" } } }),
      }
    );
  },

  async resumeCampaign(
    credentials: AdCredentials,
    platformId: string
  ): Promise<void> {
    await linkedinFetch(
      `adCampaignGroups/${platformId}`,
      credentials.accessToken,
      {
        method: "POST",
        body: JSON.stringify({ patch: { $set: { status: "ACTIVE" } } }),
      }
    );
  },

  async removeCampaign(
    credentials: AdCredentials,
    platformId: string
  ): Promise<void> {
    await linkedinFetch(
      `adCampaignGroups/${platformId}`,
      credentials.accessToken,
      {
        method: "POST",
        body: JSON.stringify({ patch: { $set: { status: "ARCHIVED" } } }),
      }
    );
  },

  async createAdGroup(
    credentials: AdCredentials,
    campaignPlatformId: string,
    adGroup: AdGroupSpec
  ): Promise<PlatformAdGroupResult> {
    const body: Record<string, unknown> = {
      account: `urn:li:sponsoredAccount:${credentials.accountId}`,
      campaignGroup: `urn:li:sponsoredCampaignGroup:${campaignPlatformId}`,
      name: adGroup.name,
      type: "SPONSORED_UPDATES",
      costType: "CPC",
      status: "ACTIVE",
      objectiveType: "WEBSITE_VISITS",
    };

    if (adGroup.dailyBudget) {
      body.dailyBudget = {
        amount: String(Math.round(adGroup.dailyBudget * 100)),
        currencyCode: "USD",
      };
    }
    if (adGroup.bidAmount) {
      body.unitCost = {
        amount: String(Math.round(adGroup.bidAmount * 100)),
        currencyCode: "USD",
      };
    }

    // Targeting facets
    const targetingCriteria: {
      include: { and: Array<Record<string, unknown>> };
    } = { include: { and: [] } };

    if (adGroup.targeting.locations?.length) {
      targetingCriteria.include.and.push({
        or: {
          "urn:li:adTargetingFacet:locations": adGroup.targeting.locations.map(
            (loc) => `urn:li:geo:${loc}`
          ),
        },
      });
    }

    if (adGroup.targeting.interests?.length) {
      targetingCriteria.include.and.push({
        or: {
          "urn:li:adTargetingFacet:interests": adGroup.targeting.interests.map(
            (i) => `urn:li:interest:${i}`
          ),
        },
      });
    }

    if (adGroup.targeting.languages?.length) {
      targetingCriteria.include.and.push({
        or: {
          "urn:li:adTargetingFacet:interfaceLocales": adGroup.targeting.languages.map(
            (lang) => `urn:li:locale:${lang}_US`
          ),
        },
      });
    }

    if (adGroup.targeting.ageMin || adGroup.targeting.ageMax) {
      const ageRanges: string[] = [];
      const min = adGroup.targeting.ageMin || 18;
      const max = adGroup.targeting.ageMax || 65;
      if (min <= 24 && max >= 18) ageRanges.push("urn:li:ageRange:(18,24)");
      if (min <= 34 && max >= 25) ageRanges.push("urn:li:ageRange:(25,34)");
      if (min <= 54 && max >= 35) ageRanges.push("urn:li:ageRange:(35,54)");
      if (max >= 55) ageRanges.push("urn:li:ageRange:(55,2147483647)");

      if (ageRanges.length > 0) {
        targetingCriteria.include.and.push({
          or: { "urn:li:adTargetingFacet:ageRanges": ageRanges },
        });
      }
    }

    if (targetingCriteria.include.and.length > 0) {
      body.targetingCriteria = targetingCriteria;
    }

    const res = await fetch(`${LINKEDIN_API_BASE}adCampaigns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
        "LinkedIn-Version": "202401",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(
        `LinkedIn API error: ${(errData as { message?: string }).message || res.statusText}`
      );
    }

    const adGroupId = res.headers.get("x-restli-id") || "";
    return { platformId: adGroupId, status: "ACTIVE" };
  },

  async updateAdGroup(
    credentials: AdCredentials,
    platformId: string,
    updates: Partial<AdGroupSpec>
  ): Promise<PlatformAdGroupResult> {
    const body: Record<string, unknown> = {};
    if (updates.name) body.name = updates.name;
    if (updates.dailyBudget) {
      body.dailyBudget = {
        amount: String(Math.round(updates.dailyBudget * 100)),
        currencyCode: "USD",
      };
    }

    await linkedinFetch(
      `adCampaigns/${platformId}`,
      credentials.accessToken,
      { method: "POST", body: JSON.stringify({ patch: { $set: body } }) }
    );

    return { platformId, status: "ACTIVE" };
  },

  async createAd(
    credentials: AdCredentials,
    adGroupPlatformId: string,
    ad: AdSpec
  ): Promise<PlatformAdResult> {
    const body: Record<string, unknown> = {
      campaign: `urn:li:sponsoredCampaign:${adGroupPlatformId}`,
      status: "ACTIVE",
      intendedStatus: "ACTIVE",
      content: {
        contentType: "SINGLE_IMAGE",
        singleImage: {
          commentary: ad.body,
          ctaLabel: ad.callToAction.toUpperCase().replace(/\s+/g, "_"),
          landingPage: ad.destinationUrl,
          title: ad.headline,
        },
      },
    };

    if (ad.imageUrl) {
      (body.content as Record<string, unknown>).singleImage = {
        ...((body.content as Record<string, Record<string, unknown>>).singleImage),
        image: ad.imageUrl,
      };
    }

    const res = await fetch(`${LINKEDIN_API_BASE}adCreatives`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
        "LinkedIn-Version": "202401",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(
        `LinkedIn API error: ${(errData as { message?: string }).message || res.statusText}`
      );
    }

    const creativeId = res.headers.get("x-restli-id") || "";

    return {
      platformId: creativeId,
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

    const [startYear, startMonth, startDay] = dateRange.start.split("-").map(Number);
    const [endYear, endMonth, endDay] = dateRange.end.split("-").map(Number);

    const campaignUrns = campaignPlatformIds
      .map((id) => `urn:li:sponsoredCampaign:${id}`)
      .join(",");

    const data = (await linkedinFetch(
      `adAnalytics?q=analytics&pivot=CAMPAIGN&dateRange=(start:(year:${startYear},month:${startMonth},day:${startDay}),end:(year:${endYear},month:${endMonth},day:${endDay}))&timeGranularity=DAILY&campaigns=List(${encodeURIComponent(campaignUrns)})&fields=impressions,clicks,externalWebsiteConversions,costInLocalCurrency,dateRange,pivotValue`,
      credentials.accessToken
    )) as {
      elements?: Array<{
        pivotValue: string;
        dateRange: { start: { year: number; month: number; day: number } };
        impressions: number;
        clicks: number;
        externalWebsiteConversions: number;
        costInLocalCurrency: string;
      }>;
    };

    if (data.elements) {
      for (const row of data.elements) {
        const impressions = row.impressions || 0;
        const clicks = row.clicks || 0;
        const conversions = row.externalWebsiteConversions || 0;
        const spend = parseFloat(row.costInLocalCurrency) / 100 || 0; // cents to dollars
        const revenue = 0; // LinkedIn doesn't return revenue directly

        const d = row.dateRange.start;
        const date = `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

        // Extract campaign ID from URN
        const campaignId = row.pivotValue.replace("urn:li:sponsoredCampaign:", "");

        results.push({
          campaignPlatformId: campaignId,
          date,
          impressions,
          clicks,
          conversions,
          spend,
          revenue,
          ctr: impressions > 0 ? clicks / impressions : 0,
          cpc: clicks > 0 ? spend / clicks : 0,
          cpa: conversions > 0 ? spend / conversions : null,
          roas: null, // No revenue data from LinkedIn
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
    await linkedinFetch(
      `adCampaignGroups/${campaignPlatformId}`,
      credentials.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          patch: {
            $set: {
              dailyBudget: {
                amount: String(Math.round(dailyBudget * 100)),
                currencyCode: "USD",
              },
            },
          },
        }),
      }
    );
  },
};
