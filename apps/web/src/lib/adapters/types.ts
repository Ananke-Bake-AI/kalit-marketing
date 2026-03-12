/**
 * Channel Abstraction Layer
 *
 * Platform-agnostic interfaces for ad channel operations.
 * Each adapter (Meta, Google, TikTok, etc.) implements this interface,
 * translating canonical models to/from platform-specific formats.
 */

export interface ChannelAdapter {
  platform: string;

  // Auth
  validateCredentials(credentials: AdCredentials): Promise<boolean>;
  getAccountInfo(credentials: AdCredentials): Promise<AccountInfo>;

  // Campaigns
  createCampaign(
    credentials: AdCredentials,
    campaign: CampaignSpec
  ): Promise<PlatformCampaignResult>;
  updateCampaign(
    credentials: AdCredentials,
    platformId: string,
    updates: Partial<CampaignSpec>
  ): Promise<PlatformCampaignResult>;
  pauseCampaign(
    credentials: AdCredentials,
    platformId: string
  ): Promise<void>;
  resumeCampaign(
    credentials: AdCredentials,
    platformId: string
  ): Promise<void>;

  // Ad Groups / Ad Sets
  createAdGroup(
    credentials: AdCredentials,
    campaignPlatformId: string,
    adGroup: AdGroupSpec
  ): Promise<PlatformAdGroupResult>;
  updateAdGroup(
    credentials: AdCredentials,
    platformId: string,
    updates: Partial<AdGroupSpec>
  ): Promise<PlatformAdGroupResult>;

  // Creatives / Ads
  createAd(
    credentials: AdCredentials,
    adGroupPlatformId: string,
    ad: AdSpec
  ): Promise<PlatformAdResult>;

  // Performance
  getPerformance(
    credentials: AdCredentials,
    campaignPlatformIds: string[],
    dateRange: DateRange
  ): Promise<PerformanceData[]>;

  // Budget
  updateBudget(
    credentials: AdCredentials,
    campaignPlatformId: string,
    dailyBudget: number
  ): Promise<void>;
}

// ============================================================
// Shared types for all adapters
// ============================================================

export interface AdCredentials {
  accessToken: string;
  refreshToken?: string;
  accountId: string;
  metadata?: Record<string, string>;
}

export interface AccountInfo {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  status: string;
}

export interface CampaignSpec {
  name: string;
  objective: CampaignObjective;
  dailyBudget: number;
  totalBudget?: number;
  currency: string;
  startDate?: string;
  endDate?: string;
  targetGeos?: string[];
  status?: "active" | "paused";
}

export type CampaignObjective =
  | "awareness"
  | "traffic"
  | "engagement"
  | "leads"
  | "conversions"
  | "sales";

export interface AdGroupSpec {
  name: string;
  targeting: TargetingSpec;
  placements?: string[];
  dailyBudget?: number;
  bidStrategy?: string;
  bidAmount?: number;
}

export interface TargetingSpec {
  ageMin?: number;
  ageMax?: number;
  genders?: ("male" | "female" | "all")[];
  locations?: string[];
  interests?: string[];
  keywords?: string[];
  audiences?: string[];
  excludeAudiences?: string[];
  languages?: string[];
  devices?: string[];
}

export interface AdSpec {
  name: string;
  headline: string;
  body: string;
  callToAction: string;
  destinationUrl: string;
  imageUrl?: string;
  videoUrl?: string;
  displayUrl?: string;
  descriptions?: string[];
}

export interface PlatformCampaignResult {
  platformId: string;
  status: string;
  reviewStatus?: string;
  effectiveDailyBudget?: number;
}

export interface PlatformAdGroupResult {
  platformId: string;
  status: string;
}

export interface PlatformAdResult {
  platformId: string;
  status: string;
  reviewStatus?: string;
  policyIssues?: string[];
}

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;
}

export interface PerformanceData {
  campaignPlatformId: string;
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpa: number | null;
  roas: number | null;
}
