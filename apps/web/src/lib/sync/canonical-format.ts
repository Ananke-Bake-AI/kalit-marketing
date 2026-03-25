/**
 * Canonical Sync Format — platform-agnostic representation of ad platform data.
 *
 * Every browser-scraped sync (X, Meta, TikTok, etc.) gets normalized into this
 * format before being stored. This ensures the analysis engine always works with
 * consistent data regardless of which platform it came from.
 */

export interface CanonicalMetrics {
  impressions?: number;
  clicks?: number;
  spend?: number;
  conversions?: number;
  revenue?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  cpa?: number;
  roas?: number;
  engagements?: number;
  reach?: number;
  frequency?: number;
  videoViews?: number;
  followers?: number;
  likes?: number;
  retweets?: number;
  shares?: number;
  replies?: number;
  saves?: number;
}

export interface CanonicalCreative {
  name: string;
  platformId?: string;
  type?: string;
  status?: string;
  metrics: CanonicalMetrics;
  content?: {
    headline?: string;
    body?: string;
    mediaUrl?: string;
    destinationUrl?: string;
  };
}

export interface CanonicalAdGroup {
  name: string;
  platformId?: string;
  status?: string;
  metrics: CanonicalMetrics;
  targeting?: {
    locations?: string[];
    interests?: string[];
    keywords?: string[];
    ageRange?: string;
    genders?: string[];
    devices?: string[];
    followerLookalikes?: string[];
  };
  creatives?: CanonicalCreative[];
}

export interface CanonicalCampaign {
  name: string;
  platformId?: string;
  status?: string;
  objective?: string;
  budget?: {
    daily?: number;
    total?: number;
    currency?: string;
  };
  metrics: CanonicalMetrics;
  adGroups?: CanonicalAdGroup[];
}

export interface AudienceSegment {
  label: string;
  metrics: CanonicalMetrics;
}

export interface AudienceInsight {
  dimension: string; // "age", "gender", "location", "device", "interest"
  segments: AudienceSegment[];
}

export interface ConversionEvent {
  name: string;
  count?: number;
  value?: number;
  attribution?: string;
}

export interface CrawledPage {
  url: string;
  pageType: string;
  scrapedAt: string;
}

/**
 * The canonical sync payload sent from the extension to the backend.
 * This is the output of the multi-page crawl + normalization pipeline.
 */
export interface CanonicalSyncData {
  platform: string;
  syncedAt: string;
  workspaceId?: string;

  /** Account-level aggregate metrics (from dashboard/overview page) */
  accountOverview?: CanonicalMetrics;

  /** All campaigns found across crawled pages */
  campaigns: CanonicalCampaign[];

  /** Audience demographic/interest breakdowns */
  audienceInsights?: AudienceInsight[];

  /** Conversion event definitions and counts */
  conversionEvents?: ConversionEvent[];

  /** Every page that was crawled (for audit/debug) */
  crawledPages: CrawledPage[];
}

/**
 * What the AI returns for each analyzed page during the crawl.
 */
export interface PageAnalysis {
  pageType: string;
  useful: boolean;
  data: {
    campaigns?: Partial<CanonicalCampaign>[];
    accountMetrics?: CanonicalMetrics;
    adGroups?: Partial<CanonicalAdGroup>[];
    creatives?: Partial<CanonicalCreative>[];
    audienceInsights?: AudienceInsight[];
    conversionEvents?: ConversionEvent[];
  };
  nextPages: string[];
}
