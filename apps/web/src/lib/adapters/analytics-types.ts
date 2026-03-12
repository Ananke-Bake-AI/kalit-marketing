export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;
}

export interface AnalyticsCredentials {
  apiKey?: string;
  accessToken?: string;
  projectId?: string;
  propertyId?: string;
  host?: string;
  metadata?: Record<string, string>;
}

export interface EventCountData {
  eventName: string;
  count: number;
  uniqueUsers: number;
}

export interface FunnelData {
  steps: Array<{ name: string; count: number; dropoff: number }>;
  overallConversion: number;
}

export interface TrafficSourceData {
  source: string;
  medium: string;
  sessions: number;
  conversions: number;
  revenue: number;
}

export interface AnalyticsAdapter {
  platform: string;
  validateCredentials(credentials: AnalyticsCredentials): Promise<boolean>;
  getEventCounts(credentials: AnalyticsCredentials, events: string[], dateRange: DateRange): Promise<EventCountData[]>;
  getFunnelData(credentials: AnalyticsCredentials, funnelSteps: string[], dateRange: DateRange): Promise<FunnelData>;
  getTrafficSources(credentials: AnalyticsCredentials, dateRange: DateRange): Promise<TrafficSourceData[]>;
  getActiveUsers?(credentials: AnalyticsCredentials): Promise<number>;
}
