import type {
  AnalyticsAdapter,
  AnalyticsCredentials,
  DateRange,
  EventCountData,
  FunnelData,
  TrafficSourceData,
} from "./analytics-types";

const GA4_BASE = "https://analyticsdata.googleapis.com/v1beta";

function headers(credentials: AnalyticsCredentials): HeadersInit {
  return {
    Authorization: `Bearer ${credentials.accessToken}`,
    "Content-Type": "application/json",
  };
}

async function runReport(
  credentials: AnalyticsCredentials,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = `${GA4_BASE}/properties/${credentials.propertyId}:runReport`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(credentials),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 runReport failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export class GA4Adapter implements AnalyticsAdapter {
  platform = "ga4";

  async validateCredentials(credentials: AnalyticsCredentials): Promise<boolean> {
    try {
      const url = `https://analyticsadmin.googleapis.com/v1beta/properties/${credentials.propertyId}`;
      const res = await fetch(url, { headers: headers(credentials) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getEventCounts(
    credentials: AnalyticsCredentials,
    events: string[],
    dateRange: DateRange
  ): Promise<EventCountData[]> {
    const body = {
      dateRanges: [{ startDate: dateRange.start, endDate: dateRange.end }],
      dimensions: [{ name: "eventName" }],
      metrics: [
        { name: "eventCount" },
        { name: "totalUsers" },
      ],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          inListFilter: { values: events },
        },
      },
    };

    const data = await runReport(credentials, body);
    const rows = (data.rows as Array<{
      dimensionValues: Array<{ value: string }>;
      metricValues: Array<{ value: string }>;
    }>) ?? [];

    return rows.map((row) => ({
      eventName: row.dimensionValues[0].value,
      count: parseInt(row.metricValues[0].value, 10),
      uniqueUsers: parseInt(row.metricValues[1].value, 10),
    }));
  }

  async getFunnelData(
    credentials: AnalyticsCredentials,
    funnelSteps: string[],
    dateRange: DateRange
  ): Promise<FunnelData> {
    const url = `${GA4_BASE}/properties/${credentials.propertyId}:runFunnelReport`;
    const body = {
      dateRanges: [{ startDate: dateRange.start, endDate: dateRange.end }],
      funnel: {
        steps: funnelSteps.map((step) => ({
          name: step,
          filterExpression: {
            funnelFieldFilter: {
              fieldName: "eventName",
              stringFilter: { value: step, matchType: "EXACT" },
            },
          },
        })),
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: headers(credentials),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GA4 runFunnelReport failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as {
      funnelTable?: {
        rows?: Array<{
          dimensionValues: Array<{ value: string }>;
          metricValues: Array<{ value: string }>;
        }>;
      };
    };

    const rows = data.funnelTable?.rows ?? [];
    const steps = rows.map((row, i) => {
      const count = parseInt(row.metricValues[0]?.value ?? "0", 10);
      const prevCount = i > 0 ? parseInt(rows[i - 1].metricValues[0]?.value ?? "0", 10) : count;
      return {
        name: row.dimensionValues[0]?.value ?? funnelSteps[i] ?? `Step ${i + 1}`,
        count,
        dropoff: i === 0 ? 0 : prevCount > 0 ? (prevCount - count) / prevCount : 0,
      };
    });

    const firstCount = steps[0]?.count ?? 0;
    const lastCount = steps[steps.length - 1]?.count ?? 0;
    const overallConversion = firstCount > 0 ? lastCount / firstCount : 0;

    return { steps, overallConversion };
  }

  async getTrafficSources(
    credentials: AnalyticsCredentials,
    dateRange: DateRange
  ): Promise<TrafficSourceData[]> {
    const body = {
      dateRanges: [{ startDate: dateRange.start, endDate: dateRange.end }],
      dimensions: [
        { name: "sessionSource" },
        { name: "sessionMedium" },
      ],
      metrics: [
        { name: "sessions" },
        { name: "conversions" },
        { name: "totalRevenue" },
      ],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 100,
    };

    const data = await runReport(credentials, body);
    const rows = (data.rows as Array<{
      dimensionValues: Array<{ value: string }>;
      metricValues: Array<{ value: string }>;
    }>) ?? [];

    return rows.map((row) => ({
      source: row.dimensionValues[0].value,
      medium: row.dimensionValues[1].value,
      sessions: parseInt(row.metricValues[0].value, 10),
      conversions: parseInt(row.metricValues[1].value, 10),
      revenue: parseFloat(row.metricValues[2].value),
    }));
  }

  async getActiveUsers(credentials: AnalyticsCredentials): Promise<number> {
    const url = `${GA4_BASE}/properties/${credentials.propertyId}:runRealtimeReport`;
    const body = {
      metrics: [{ name: "activeUsers" }],
    };

    const res = await fetch(url, {
      method: "POST",
      headers: headers(credentials),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GA4 runRealtimeReport failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as {
      rows?: Array<{ metricValues: Array<{ value: string }> }>;
    };

    return parseInt(data.rows?.[0]?.metricValues?.[0]?.value ?? "0", 10);
  }
}

export const ga4Adapter = new GA4Adapter();
