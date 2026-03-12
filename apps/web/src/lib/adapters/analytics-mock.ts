import type {
  AnalyticsAdapter,
  AnalyticsCredentials,
  DateRange,
  EventCountData,
  FunnelData,
  TrafficSourceData,
} from "./analytics-types";

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.round(randomBetween(min, max));
}

export class MockAnalyticsAdapter implements AnalyticsAdapter {
  platform: string;

  constructor(platform: string = "mock_analytics") {
    this.platform = platform;
  }

  async validateCredentials(_credentials: AnalyticsCredentials): Promise<boolean> {
    return true;
  }

  async getEventCounts(
    _credentials: AnalyticsCredentials,
    events: string[],
    _dateRange: DateRange
  ): Promise<EventCountData[]> {
    return events.map((eventName) => {
      const uniqueUsers = randomInt(100, 5000);
      return {
        eventName,
        count: randomInt(uniqueUsers, uniqueUsers * 3),
        uniqueUsers,
      };
    });
  }

  async getFunnelData(
    _credentials: AnalyticsCredentials,
    funnelSteps: string[],
    _dateRange: DateRange
  ): Promise<FunnelData> {
    let currentCount = randomInt(5000, 20000);
    const steps = funnelSteps.map((name, i) => {
      const count = i === 0 ? currentCount : Math.round(currentCount * randomBetween(0.3, 0.8));
      const dropoff = i === 0 ? 0 : (currentCount - count) / currentCount;
      currentCount = count;
      return { name, count, dropoff };
    });

    const firstCount = steps[0]?.count ?? 0;
    const lastCount = steps[steps.length - 1]?.count ?? 0;
    const overallConversion = firstCount > 0 ? lastCount / firstCount : 0;

    return { steps, overallConversion };
  }

  async getTrafficSources(
    _credentials: AnalyticsCredentials,
    _dateRange: DateRange
  ): Promise<TrafficSourceData[]> {
    const sources = [
      { source: "google", medium: "organic" },
      { source: "google", medium: "cpc" },
      { source: "facebook", medium: "social" },
      { source: "twitter", medium: "social" },
      { source: "(direct)", medium: "(none)" },
      { source: "linkedin", medium: "social" },
      { source: "producthunt", medium: "referral" },
      { source: "newsletter", medium: "email" },
    ];

    return sources.map(({ source, medium }) => {
      const sessions = randomInt(50, 10000);
      const conversionRate = randomBetween(0.01, 0.08);
      const conversions = Math.round(sessions * conversionRate);
      const avgRevenue = randomBetween(20, 200);
      return {
        source,
        medium,
        sessions,
        conversions,
        revenue: Math.round(conversions * avgRevenue * 100) / 100,
      };
    });
  }

  async getActiveUsers(_credentials: AnalyticsCredentials): Promise<number> {
    return randomInt(10, 500);
  }
}

export const mockAnalyticsAdapter = new MockAnalyticsAdapter();
