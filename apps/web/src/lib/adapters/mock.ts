import type {
  ChannelAdapter,
  AdCredentials,
  AccountInfo,
  CampaignSpec,
  AdGroupSpec,
  AdSpec,
  DateRange,
  PerformanceData,
  PlatformCampaignResult,
  PlatformAdGroupResult,
  PlatformAdResult,
} from "./types";

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export class MockAdapter implements ChannelAdapter {
  platform: string;

  constructor(platform: string = "mock") {
    this.platform = platform;
  }

  async validateCredentials(_credentials: AdCredentials): Promise<boolean> {
    return true;
  }

  async getAccountInfo(credentials: AdCredentials): Promise<AccountInfo> {
    return {
      id: credentials.accountId,
      name: `Mock ${this.platform} Account`,
      currency: "USD",
      timezone: "America/New_York",
      status: "active",
    };
  }

  async createCampaign(
    _credentials: AdCredentials,
    _campaign: CampaignSpec
  ): Promise<PlatformCampaignResult> {
    return {
      platformId: `mock_camp_${Date.now()}`,
      status: "active",
      reviewStatus: "approved",
    };
  }

  async updateCampaign(
    _credentials: AdCredentials,
    platformId: string,
    _updates: Partial<CampaignSpec>
  ): Promise<PlatformCampaignResult> {
    return {
      platformId,
      status: "active",
    };
  }

  async pauseCampaign(
    _credentials: AdCredentials,
    _platformId: string
  ): Promise<void> {}

  async resumeCampaign(
    _credentials: AdCredentials,
    _platformId: string
  ): Promise<void> {}

  async createAdGroup(
    _credentials: AdCredentials,
    _campaignPlatformId: string,
    _adGroup: AdGroupSpec
  ): Promise<PlatformAdGroupResult> {
    return {
      platformId: `mock_ag_${Date.now()}`,
      status: "active",
    };
  }

  async updateAdGroup(
    _credentials: AdCredentials,
    platformId: string,
    _updates: Partial<AdGroupSpec>
  ): Promise<PlatformAdGroupResult> {
    return {
      platformId,
      status: "active",
    };
  }

  async createAd(
    _credentials: AdCredentials,
    _adGroupPlatformId: string,
    _ad: AdSpec
  ): Promise<PlatformAdResult> {
    return {
      platformId: `mock_ad_${Date.now()}`,
      status: "active",
      reviewStatus: "approved",
    };
  }

  async getPerformance(
    _credentials: AdCredentials,
    campaignPlatformIds: string[],
    dateRange: DateRange
  ): Promise<PerformanceData[]> {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const results: PerformanceData[] = [];

    for (const campaignId of campaignPlatformIds) {
      const current = new Date(start);
      while (current <= end) {
        const spend = randomBetween(50, 500);
        const impressions = Math.round(randomBetween(1000, 50000));
        const ctr = randomBetween(0.01, 0.05);
        const clicks = Math.round(impressions * ctr);
        const conversionRate = randomBetween(0.02, 0.08);
        const conversions = Math.round(clicks * conversionRate);
        const roas = randomBetween(2, 5);
        const revenue = spend * roas;
        const cpc = clicks > 0 ? spend / clicks : 0;
        const cpa = conversions > 0 ? spend / conversions : null;

        results.push({
          campaignPlatformId: campaignId,
          date: current.toISOString().split("T")[0],
          impressions,
          clicks,
          conversions,
          spend: Math.round(spend * 100) / 100,
          revenue: Math.round(revenue * 100) / 100,
          ctr: Math.round(ctr * 10000) / 10000,
          cpc: Math.round(cpc * 100) / 100,
          cpa: cpa !== null ? Math.round(cpa * 100) / 100 : null,
          roas: Math.round(roas * 100) / 100,
        });

        current.setDate(current.getDate() + 1);
      }
    }

    return results;
  }

  async updateBudget(
    _credentials: AdCredentials,
    _campaignPlatformId: string,
    _dailyBudget: number
  ): Promise<void> {}
}

export const mockAdapter = new MockAdapter();
