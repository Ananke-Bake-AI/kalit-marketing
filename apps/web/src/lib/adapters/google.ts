/**
 * Google Ads Execution Adapter (gRPC)
 *
 * Uses the google-ads-api npm package (gRPC/protobuf) — the REST API
 * is deprecated and returns 404/501 for all versions.
 *
 * Maximally leverages Google's AI optimization:
 * 1. Smart Bidding — Target CPA / Target ROAS / Maximize Conversions
 * 2. Responsive Search Ads — up to 15 headlines + 4 descriptions, UNPINNED
 * 3. Broad Match keywords — lets Google's AI expand to related searches
 * 4. Optimized Targeting — Google expands audience beyond your targeting
 * 5. Performance Max — Google's AI picks the best channels automatically
 */

import {
  GoogleAdsApi,
  enums,
  ResourceNames,
  toMicros,
  type MutateOperation,
  type Customer,
} from "google-ads-api";

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
  AdGroupPerformanceData,
} from "./types";
import { getPlatformKey } from "../platform-keys";

// ============================================================
// Client Factory
// ============================================================

function getCustomer(credentials: AdCredentials): Customer {
  const clientId = getPlatformKey("GOOGLE_CLIENT_ID") || "";
  const clientSecret = getPlatformKey("GOOGLE_CLIENT_SECRET") || "";
  const developerToken = credentials.metadata?.developerToken || getPlatformKey("GOOGLE_ADS_DEVELOPER_TOKEN") || "";

  const api = new GoogleAdsApi({
    client_id: clientId,
    client_secret: clientSecret,
    developer_token: developerToken,
  });

  return api.Customer({
    customer_id: credentials.accountId,
    refresh_token: credentials.refreshToken || "",
    login_customer_id: credentials.metadata?.loginCustomerId || credentials.accountId,
  });
}

// ============================================================
// Google AI Strategy: Campaign Type Selection
// ============================================================

function selectChannelType(
  objective: CampaignObjective,
  usePerformanceMax?: boolean
): number {
  if (usePerformanceMax) return enums.AdvertisingChannelType.PERFORMANCE_MAX;

  const map: Record<CampaignObjective, number> = {
    awareness: enums.AdvertisingChannelType.DISPLAY,
    traffic: enums.AdvertisingChannelType.SEARCH,
    engagement: enums.AdvertisingChannelType.DISPLAY,
    leads: enums.AdvertisingChannelType.SEARCH,
    conversions: enums.AdvertisingChannelType.SEARCH,
    sales: enums.AdvertisingChannelType.PERFORMANCE_MAX,
  };
  return map[objective] || enums.AdvertisingChannelType.SEARCH;
}

// ============================================================
// Google AI Strategy: Smart Bidding
// ============================================================

function buildBiddingFields(
  objective: CampaignObjective,
  targetCpa?: number,
  targetRoas?: number,
  hasConversionTracking = false
): Record<string, unknown> {
  // Google Ads API requires bidding strategy as a oneof field on the campaign
  // resource, NOT as separate bidding_strategy_type + nested object.
  // IMPORTANT: maximize_conversions / maximize_conversion_value require
  // conversion tracking to be set up — without it Google returns
  // CONVERSION_TRACKING_NOT_ENABLED. Fall back to manual_cpc / maximize_clicks.

  if (hasConversionTracking) {
    if (targetRoas && targetRoas > 0) {
      return {
        maximize_conversion_value: {
          target_roas: targetRoas,
        },
      };
    }

    if (targetCpa && targetCpa > 0) {
      return {
        maximize_conversions: {
          target_cpa_micros: toMicros(targetCpa),
        },
      };
    }
  }

  // NOTE: maximize_clicks is NOT in the proto schema (google-ads-node bug) — it
  // silently gets dropped during gRPC serialization. Use manual_cpc or target_spend.
  // manual_cpc: {} serializes correctly even when empty (proto3 keeps empty messages
  // for oneof fields). Do NOT set enhanced_cpc_enabled — requires conversion tracking.
  const safeBidding = { manual_cpc: {} };

  const strategyMap: Record<CampaignObjective, Record<string, unknown>> = {
    awareness: { target_impression_share: { location: enums.TargetImpressionShareLocation.ANYWHERE_ON_PAGE, location_fraction_micros: 500000 } },
    traffic: safeBidding,
    engagement: safeBidding,
    leads: hasConversionTracking ? { maximize_conversions: { target_cpa_micros: toMicros(50) } } : safeBidding,
    conversions: hasConversionTracking ? { maximize_conversions: { target_cpa_micros: toMicros(50) } } : safeBidding,
    sales: hasConversionTracking ? { maximize_conversion_value: { target_roas: 2.0 } } : safeBidding,
  };

  return strategyMap[objective] || safeBidding;
}

// ============================================================
// RSA Helpers — Google requires 15 headlines + 4 descriptions
// for "Excellent" ad strength. Headlines must be diverse,
// include keywords, and cover different angles.
// ============================================================

const MAX_RSA_HEADLINES = 15;
const MIN_RSA_HEADLINES = 10; // aim for at least 10 for "Good" strength
const MAX_RSA_DESCRIPTIONS = 4;
const MAX_HEADLINE_LENGTH = 30;
const MAX_DESCRIPTION_LENGTH = 90;

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  // Try to cut at a word boundary
  const cut = text.lastIndexOf(" ", maxLen - 1);
  if (cut > maxLen * 0.6) return text.slice(0, cut);
  return text.slice(0, maxLen - 1) + "…";
}

/** Capitalize first letter of each word */
function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build up to 15 diverse RSA headlines from ad content + keywords.
 * Strategy for "Excellent" ad strength:
 * 1. Primary headline (from ad.headline)
 * 2. Extra headlines provided by the creative agent
 * 3. Keyword-based headlines (direct keyword inclusion improves Quality Score)
 * 4. CTA variations
 * 5. Benefit/feature angles auto-derived from body text
 * 6. Brand/trust signals
 */
function buildRsaHeadlines(ad: AdSpec): Array<{ text: string }> {
  const seen = new Set<string>();
  const headlines: Array<{ text: string }> = [];

  function add(text: string): boolean {
    if (!text || headlines.length >= MAX_RSA_HEADLINES) return false;
    const trimmed = text.trim();
    if (!trimmed) return false;
    const t = truncate(trimmed, MAX_HEADLINE_LENGTH);
    const key = t.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    headlines.push({ text: t });
    return true;
  }

  // 1. Primary headline
  add(ad.headline);

  // 2. Extra headlines from creative agent (these are already optimized)
  if (ad.headlines) {
    for (const h of ad.headlines) add(h);
  }

  // 3. Short descriptions that fit as headlines
  if (ad.descriptions) {
    for (const d of ad.descriptions) {
      if (d.length <= MAX_HEADLINE_LENGTH + 5) add(d);
    }
  }

  // 4. Keyword-based headlines — inject top keywords directly
  if (ad.keywords) {
    for (const kw of ad.keywords.slice(0, 6)) {
      const kwTitle = titleCase(kw);
      add(kwTitle);
      // Keyword + CTA pattern: "Best {keyword}" / "{keyword} Solutions"
      if (headlines.length < MAX_RSA_HEADLINES) {
        add(`Best ${kwTitle}`);
        add(`${kwTitle} Solutions`);
        add(`Top ${kwTitle} Services`);
        add(`${kwTitle} — Learn More`);
      }
    }
  }

  // 5. CTA variations
  if (ad.callToAction) {
    add(ad.callToAction);
    add(`${ad.callToAction} Today`);
    add(`${ad.callToAction} Now`);
  }

  // 6. Generic trust/urgency signals if we still need more
  const fillers = [
    "Get Started Today",
    "Free Consultation",
    "Trusted by Experts",
    "Results You Can See",
    "Start Now — It's Easy",
    "See Why Clients Trust Us",
    "Book a Free Demo",
    "Limited Time Offer",
    "Get Your Free Quote",
    "Try It Risk-Free",
  ];
  for (const f of fillers) {
    if (headlines.length >= MAX_RSA_HEADLINES) break;
    add(f);
  }

  // Ensure minimum of 3 (Google's hard minimum)
  if (headlines.length < 3) add(ad.name || "Learn More");

  return headlines;
}

/**
 * Build 4 diverse RSA descriptions (90 chars each).
 * Google needs variety: value prop, social proof, CTA, features.
 */
function buildRsaDescriptions(ad: AdSpec): Array<{ text: string }> {
  const seen = new Set<string>();
  const descriptions: Array<{ text: string }> = [];

  function add(text: string): boolean {
    if (!text || descriptions.length >= MAX_RSA_DESCRIPTIONS) return false;
    const trimmed = text.trim();
    if (!trimmed) return false;
    const t = truncate(trimmed, MAX_DESCRIPTION_LENGTH);
    const key = t.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    descriptions.push({ text: t });
    return true;
  }

  // 1. Primary body (value proposition)
  add(ad.body);

  // 2. Long descriptions from creative agent
  if (ad.descriptions) {
    for (const d of ad.descriptions) {
      if (d.length > MAX_HEADLINE_LENGTH) add(d);
    }
  }

  // 3. CTA + body combo
  if (ad.callToAction && descriptions.length < MAX_RSA_DESCRIPTIONS) {
    add(`${ad.callToAction}. ${ad.body}`);
  }

  // 4. Keyword-rich description
  if (ad.keywords?.length && descriptions.length < MAX_RSA_DESCRIPTIONS) {
    const kwList = ad.keywords.slice(0, 3).map(titleCase).join(", ");
    add(`Expert solutions for ${kwList}. Get results that matter.`);
  }

  // 5. Fillers if still short
  const fillers = [
    "Get started today and see measurable results. Contact our team for a free consultation.",
    "Trusted by businesses worldwide. See why clients choose us for proven growth strategies.",
  ];
  for (const f of fillers) {
    if (descriptions.length >= MAX_RSA_DESCRIPTIONS) break;
    add(f);
  }

  // Ensure minimum of 2 (Google's hard minimum)
  if (descriptions.length < 2) {
    add(ad.body || "Contact us today to learn more about our services.");
  }

  return descriptions;
}

// ============================================================
// Geo Targeting
// ============================================================

const COUNTRY_GEO_IDS: Record<string, string> = {
  "United States": "2840",
  "United Kingdom": "2826",
  "Canada": "2124",
  "Australia": "2036",
  "France": "2250",
  "Germany": "2276",
  "Netherlands": "2528",
  "Spain": "2724",
  "Italy": "2380",
  "Brazil": "2076",
  "India": "2356",
  "Japan": "2392",
  "Singapore": "2702",
  "Sweden": "2752",
  "Norway": "2578",
  "Denmark": "2208",
  "Finland": "2246",
  "Ireland": "2372",
  "New Zealand": "2554",
  "Belgium": "2056",
  "Switzerland": "2756",
  "Austria": "2040",
  "Portugal": "2620",
  "Poland": "2616",
  "Mexico": "2484",
  "South Korea": "2410",
  "Israel": "2376",
  "United Arab Emirates": "2784",
  "South Africa": "2710",
};

// ============================================================
// Sitelink Extensions — boosts ad strength from "Poor" to "Good"
// ============================================================

async function createSitelinkExtensions(
  customer: Customer,
  accountId: string,
  campaignPlatformId: string,
  sitelinks: Array<{ text: string; url: string; description1?: string; description2?: string }>,
): Promise<void> {
  // Google Ads API v15+: uses assets + campaign asset sets
  // Step 1: Create sitelink assets
  const assetOps: MutateOperation<unknown>[] = sitelinks.slice(0, 8).map((sl) => ({
    entity: "asset" as const,
    operation: "create" as const,
    resource: {
      sitelink_asset: {
        link_text: truncate(sl.text, 25),
        description1: sl.description1 ? truncate(sl.description1, 35) : undefined,
        description2: sl.description2 ? truncate(sl.description2, 35) : undefined,
      },
      final_urls: [sl.url],
    },
  }));

  const assetResult = await customer.mutateResources(assetOps);

  // Step 2: Link assets to the campaign
  const campaignResource = ResourceNames.campaign(accountId, campaignPlatformId);
  const linkOps: MutateOperation<unknown>[] = [];

  for (const resp of assetResult.mutate_operation_responses ?? []) {
    const assetResourceName = resp?.asset_result?.resource_name;
    if (!assetResourceName) continue;
    linkOps.push({
      entity: "campaign_asset" as const,
      operation: "create" as const,
      resource: {
        campaign: campaignResource,
        asset: assetResourceName,
        field_type: enums.AssetFieldType.SITELINK,
      },
    });
  }

  if (linkOps.length > 0) {
    await customer.mutateResources(linkOps);
  }
}

// ============================================================
// Adapter
// ============================================================

export const googleAdapter: ChannelAdapter = {
  platform: "google",

  async validateCredentials(credentials: AdCredentials): Promise<boolean> {
    try {
      const customer = getCustomer(credentials);
      const rows = await customer.query(
        `SELECT customer.id FROM customer LIMIT 1`
      );
      return rows.length > 0;
    } catch (err) {
      console.error("[google-ads] validateCredentials failed:", err);
      return false;
    }
  },

  async getAccountInfo(credentials: AdCredentials): Promise<AccountInfo> {
    const customer = getCustomer(credentials);
    const [row] = await customer.query(
      `SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1`
    );

    const c = (row as { customer?: { id?: string; descriptive_name?: string; currency_code?: string; time_zone?: string } }).customer ?? {};
    return {
      id: credentials.accountId,
      name: c.descriptive_name || "Google Ads Account",
      currency: c.currency_code || "USD",
      timezone: c.time_zone || "UTC",
      status: "active",
    };
  },

  async createCampaign(
    credentials: AdCredentials,
    campaign: CampaignSpec
  ): Promise<PlatformCampaignResult> {
    const customer = getCustomer(credentials);
    const channelType = selectChannelType(campaign.objective, campaign.usePerformanceMax);

    // Detect if this is a Manager (MCC) account — campaigns can't be created on MCC
    try {
      const [managerCheck] = await customer.query(
        `SELECT customer.manager FROM customer LIMIT 1`
      ) as Array<{ customer?: { manager?: boolean } }>;
      if (managerCheck?.customer?.manager) {
        throw new Error(
          `Account ${credentials.accountId} is a Manager (MCC) account. ` +
          `Campaigns must be created on a client account under the MCC. ` +
          `Set 'loginCustomerId' to the MCC ID and 'accountId' to a client account.`
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("Manager (MCC)")) throw err;
      // Non-critical — continue if the check itself fails
      console.warn("[google-ads] Manager account check failed:", err);
    }

    // Check if account has conversion tracking set up
    let hasConversionTracking = false;
    try {
      const convRows = await customer.query(
        `SELECT conversion_action.id FROM conversion_action LIMIT 1`
      );
      hasConversionTracking = convRows.length > 0;
    } catch {
      // No conversion tracking available
    }
    console.log(`[google-ads] Conversion tracking: ${hasConversionTracking ? "enabled" : "not set up — using maximize_clicks"}`);

    const biddingFields = buildBiddingFields(campaign.objective, campaign.targetCpa, campaign.targetRoas, hasConversionTracking);

    // Deduplicate name to avoid DUPLICATE_CAMPAIGN_NAME from previous failed attempts
    const campaignName = `${campaign.name} [${new Date().toISOString().slice(0, 16)}]`;

    // Step 1: Create budget
    console.log(`[google-ads] Creating budget for "${campaignName}" ($${campaign.dailyBudget}/day)`);
    const budgetResult = await customer.mutateResources([
      {
        entity: "campaign_budget",
        operation: "create",
        resource: {
          name: `${campaignName} Budget ${Date.now()}`,
          delivery_method: enums.BudgetDeliveryMethod.STANDARD,
          amount_micros: toMicros(campaign.dailyBudget),
        },
      },
    ]);

    const budgetResourceName =
      budgetResult.mutate_operation_responses?.[0]?.campaign_budget_result?.resource_name || "";
    if (!budgetResourceName) {
      throw new Error("Failed to create campaign budget — no resource name returned");
    }
    console.log(`[google-ads] Budget created: ${budgetResourceName}`);

    // Step 2: Create campaign referencing the budget
    console.log(`[google-ads] Creating campaign "${campaignName}"`);
    const campaignResult = await customer.mutateResources([
      {
        entity: "campaign",
        operation: "create",
        resource: {
          name: campaignName,
          advertising_channel_type: channelType,
          status: campaign.status === "paused"
            ? enums.CampaignStatus.PAUSED
            : enums.CampaignStatus.ENABLED,
          campaign_budget: budgetResourceName,
          ...biddingFields,
          // Required by Google for EU compliance — this is an enum, not a boolean!
          // 3 = DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
          contains_eu_political_advertising: enums.EuPoliticalAdvertisingStatus.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING,
          ...(channelType === enums.AdvertisingChannelType.PERFORMANCE_MAX
            ? { url_expansion_opt_out: false }
            : {}),
          ...(campaign.targetGeos?.length
            ? {
                geo_target_type_setting: {
                  positive_geo_target_type: enums.PositiveGeoTargetType.PRESENCE_OR_INTEREST,
                  negative_geo_target_type: enums.NegativeGeoTargetType.PRESENCE,
                },
              }
            : {}),
        },
      },
    ]);

    const campaignResourceName =
      campaignResult.mutate_operation_responses?.[0]?.campaign_result?.resource_name || "";
    const platformId = campaignResourceName.split("/").pop() || campaignResourceName;
    console.log(`[google-ads] Campaign created: ${platformId}`);

    // Add geo targeting criteria
    if (campaign.targetGeos?.length) {
      const geoOps: MutateOperation<unknown>[] = [];
      for (const location of campaign.targetGeos) {
        const geoId = COUNTRY_GEO_IDS[location];
        if (!geoId) continue;
        geoOps.push({
          entity: "campaign_criterion",
          operation: "create",
          resource: {
            campaign: campaignResourceName,
            location: {
              geo_target_constant: `geoTargetConstants/${geoId}`,
            },
            negative: false,
          },
        });
      }

      if (geoOps.length > 0) {
        try {
          await customer.mutateResources(geoOps);
          console.log(`[google-ads] Added ${geoOps.length} geo targets`);
        } catch (geoErr) {
          console.warn("[google-ads] Failed to add geo targeting:", geoErr);
        }
      }
    }

    console.log(`[google-ads] Campaign created: ${platformId}`);

    // Add sitelink extensions at campaign level (boosts ad strength + CTR)
    if (campaign.sitelinks?.length) {
      try {
        await createSitelinkExtensions(customer, credentials.accountId, platformId, campaign.sitelinks);
        console.log(`[google-ads] Added ${campaign.sitelinks.length} sitelinks`);
      } catch (slErr) {
        console.warn("[google-ads] Failed to add sitelinks:", slErr);
      }
    }

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
    const customer = getCustomer(credentials);
    const resource: Record<string, unknown> = {
      resource_name: ResourceNames.campaign(credentials.accountId, platformId),
    };

    if (updates.name) resource.name = updates.name;
    if (updates.status) {
      resource.status = updates.status === "paused"
        ? enums.CampaignStatus.PAUSED
        : enums.CampaignStatus.ENABLED;
    }

    await customer.mutateResources([
      { entity: "campaign", operation: "update", resource },
    ]);

    return { platformId, status: updates.status === "paused" ? "PAUSED" : "ENABLED" };
  },

  async pauseCampaign(
    credentials: AdCredentials,
    platformId: string
  ): Promise<void> {
    await googleAdapter.updateCampaign(credentials, platformId, { status: "paused" });
  },

  async resumeCampaign(
    credentials: AdCredentials,
    platformId: string
  ): Promise<void> {
    await googleAdapter.updateCampaign(credentials, platformId, { status: "active" });
  },

  async removeCampaign(
    credentials: AdCredentials,
    platformId: string
  ): Promise<void> {
    const customer = getCustomer(credentials);
    const resourceName = ResourceNames.campaign(credentials.accountId, platformId);
    // google-ads-api uses campaigns.remove() for the REMOVE operation
    await (customer as unknown as { campaigns: { remove: (r: string[]) => Promise<void> } }).campaigns.remove([resourceName]);
  },

  async createAdGroup(
    credentials: AdCredentials,
    campaignPlatformId: string,
    adGroup: AdGroupSpec
  ): Promise<PlatformAdGroupResult> {
    const customer = getCustomer(credentials);
    const campaignResource = ResourceNames.campaign(credentials.accountId, campaignPlatformId);

    const adGroupResource: Record<string, unknown> = {
      name: adGroup.name,
      campaign: campaignResource,
      type: enums.AdGroupType.SEARCH_STANDARD,
      status: enums.AdGroupStatus.ENABLED,
    };

    if (adGroup.bidAmount) {
      adGroupResource.cpc_bid_micros = toMicros(adGroup.bidAmount);
    }

    const result = await customer.mutateResources([
      { entity: "ad_group", operation: "create", resource: adGroupResource },
    ]);

    const adGroupResourceName = result.mutate_operation_responses?.[0]?.ad_group_result?.resource_name || "";
    const adGroupId = adGroupResourceName.split("/").pop() || adGroupResourceName;

    // Add keywords (BROAD match — Google's AI expands matching)
    if (adGroup.targeting.keywords?.length) {
      const kwOps: MutateOperation<unknown>[] = adGroup.targeting.keywords.map((keyword) => ({
        entity: "ad_group_criterion" as const,
        operation: "create" as const,
        resource: {
          ad_group: adGroupResourceName,
          keyword: {
            text: keyword,
            match_type: enums.KeywordMatchType.BROAD,
          },
          status: enums.AdGroupCriterionStatus.ENABLED,
        },
      }));

      try {
        await customer.mutateResources(kwOps);
        console.log(`[google-ads] Added ${kwOps.length} keywords to ad group "${adGroup.name}"`);
      } catch (kwErr) {
        console.warn("[google-ads] Failed to add keywords:", kwErr);
      }
    }

    // Add negative keywords
    if (adGroup.targeting.excludeAudiences?.length) {
      const negOps: MutateOperation<unknown>[] = adGroup.targeting.excludeAudiences.map((keyword) => ({
        entity: "ad_group_criterion" as const,
        operation: "create" as const,
        resource: {
          ad_group: adGroupResourceName,
          keyword: {
            text: keyword,
            match_type: enums.KeywordMatchType.EXACT,
          },
          negative: true,
          status: enums.AdGroupCriterionStatus.ENABLED,
        },
      }));

      try {
        await customer.mutateResources(negOps);
      } catch (negErr) {
        console.warn("[google-ads] Failed to add negative keywords:", negErr);
      }
    }

    console.log(`[google-ads] Ad group created: ${adGroupId}`);
    return { platformId: adGroupId, status: "ENABLED" };
  },

  async updateAdGroup(
    credentials: AdCredentials,
    platformId: string,
    updates: Partial<AdGroupSpec>
  ): Promise<PlatformAdGroupResult> {
    const customer = getCustomer(credentials);
    const resource: Record<string, unknown> = {
      resource_name: ResourceNames.adGroup(credentials.accountId, platformId),
    };

    if (updates.name) resource.name = updates.name;

    await customer.mutateResources([
      { entity: "ad_group", operation: "update", resource },
    ]);

    return { platformId, status: "ENABLED" };
  },

  async createAd(
    credentials: AdCredentials,
    adGroupPlatformId: string,
    ad: AdSpec
  ): Promise<PlatformAdResult> {
    const customer = getCustomer(credentials);
    const adGroupResource = ResourceNames.adGroup(credentials.accountId, adGroupPlatformId);

    const headlines = buildRsaHeadlines(ad);
    const descriptions = buildRsaDescriptions(ad);

    const result = await customer.mutateResources([
      {
        entity: "ad_group_ad",
        operation: "create",
        resource: {
          ad_group: adGroupResource,
          status: enums.AdGroupAdStatus.ENABLED,
          ad: {
            responsive_search_ad: {
              headlines,
              descriptions,
            },
            final_urls: [ad.destinationUrl || "https://kalit.ai"],
          },
        },
      },
    ]);

    const adResourceName = result.mutate_operation_responses?.[0]?.ad_group_ad_result?.resource_name || "";
    const adId = adResourceName.split("/").pop() || adResourceName;

    console.log(`[google-ads] Ad created: ${adId}`);
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
    const customer = getCustomer(credentials);
    // Sanitize campaign IDs to prevent GAQL injection (only allow digits)
    const safeIds = campaignPlatformIds
      .filter((id) => /^\d+$/.test(id))
      .map((id) => `'${id}'`)
      .join(", ");
    if (!safeIds) return [];

    // Sanitize date range (must be YYYY-MM-DD)
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(dateRange.start) || !dateRe.test(dateRange.end)) return [];

    const rows = await customer.query(`
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
      WHERE campaign.id IN (${safeIds})
        AND segments.date BETWEEN '${dateRange.start}' AND '${dateRange.end}'
      ORDER BY segments.date
    `);

    return (rows as Array<{
      campaign?: { id?: string };
      segments?: { date?: string };
      metrics?: {
        impressions?: number;
        clicks?: number;
        conversions?: number;
        cost_micros?: number;
        conversions_value?: number;
        ctr?: number;
        average_cpc?: number;
      };
    }>).map((row) => {
      const spend = (row.metrics?.cost_micros || 0) / 1_000_000;
      const conversions = row.metrics?.conversions || 0;
      const revenue = row.metrics?.conversions_value || 0;

      return {
        campaignPlatformId: String(row.campaign?.id || ""),
        date: row.segments?.date || "",
        impressions: row.metrics?.impressions || 0,
        clicks: row.metrics?.clicks || 0,
        conversions,
        spend,
        revenue,
        ctr: row.metrics?.ctr || 0,
        cpc: (row.metrics?.average_cpc || 0) / 1_000_000,
        cpa: conversions > 0 ? spend / conversions : null,
        roas: spend > 0 ? revenue / spend : null,
      };
    });
  },

  async getAdGroupPerformance(
    credentials: AdCredentials,
    campaignPlatformIds: string[],
    dateRange: DateRange
  ): Promise<AdGroupPerformanceData[]> {
    const customer = getCustomer(credentials);

    const safeIds = campaignPlatformIds
      .filter((id) => /^\d+$/.test(id))
      .map((id) => `'${id}'`)
      .join(", ");
    if (!safeIds) return [];

    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(dateRange.start) || !dateRe.test(dateRange.end)) return [];

    const rows = await customer.query(`
      SELECT
        ad_group.id,
        campaign.id,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros,
        metrics.conversions_value
      FROM ad_group
      WHERE campaign.id IN (${safeIds})
        AND segments.date BETWEEN '${dateRange.start}' AND '${dateRange.end}'
      ORDER BY segments.date
    `);

    return (rows as Array<{
      ad_group?: { id?: string };
      campaign?: { id?: string };
      segments?: { date?: string };
      metrics?: {
        impressions?: number;
        clicks?: number;
        conversions?: number;
        cost_micros?: number;
        conversions_value?: number;
      };
    }>).map((row) => ({
      adGroupPlatformId: String(row.ad_group?.id || ""),
      campaignPlatformId: String(row.campaign?.id || ""),
      date: row.segments?.date || "",
      impressions: row.metrics?.impressions || 0,
      clicks: row.metrics?.clicks || 0,
      conversions: row.metrics?.conversions || 0,
      spend: (row.metrics?.cost_micros || 0) / 1_000_000,
      revenue: row.metrics?.conversions_value || 0,
    }));
  },

  async updateBudget(
    credentials: AdCredentials,
    campaignPlatformId: string,
    dailyBudget: number
  ): Promise<void> {
    const customer = getCustomer(credentials);

    // First find the budget resource
    const [row] = await customer.query(
      `SELECT campaign.campaign_budget FROM campaign WHERE campaign.id = ${campaignPlatformId}`
    ) as Array<{ campaign?: { campaign_budget?: string } }>;

    const budgetResource = row?.campaign?.campaign_budget;
    if (!budgetResource) throw new Error("Campaign budget not found");

    await customer.mutateResources([
      {
        entity: "campaign_budget",
        operation: "update",
        resource: {
          resource_name: budgetResource,
          amount_micros: toMicros(dailyBudget),
        },
      },
    ]);
  },
};
