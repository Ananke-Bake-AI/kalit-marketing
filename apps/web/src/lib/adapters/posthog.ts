import type {
  AnalyticsAdapter,
  AnalyticsCredentials,
  DateRange,
  EventCountData,
  FunnelData,
  TrafficSourceData,
} from "./analytics-types";

function baseUrl(credentials: AnalyticsCredentials): string {
  return (credentials.host ?? "https://app.posthog.com").replace(/\/+$/, "");
}

function headers(credentials: AnalyticsCredentials): HeadersInit {
  return {
    Authorization: `Bearer ${credentials.apiKey}`,
    "Content-Type": "application/json",
  };
}

export class PostHogAdapter implements AnalyticsAdapter {
  platform = "posthog";

  async validateCredentials(credentials: AnalyticsCredentials): Promise<boolean> {
    try {
      const url = `${baseUrl(credentials)}/api/projects/${credentials.projectId}/`;
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
    const base = baseUrl(credentials);
    const results: EventCountData[] = [];

    for (const eventName of events) {
      const body = {
        insight: "TRENDS",
        events: [
          {
            id: eventName,
            math: "total",
          },
        ],
        date_from: dateRange.start,
        date_to: dateRange.end,
      };

      const res = await fetch(
        `${base}/api/projects/${credentials.projectId}/insights/trend/`,
        {
          method: "POST",
          headers: headers(credentials),
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`PostHog trend failed (${res.status}): ${text}`);
      }

      const data = (await res.json()) as {
        result?: Array<{
          count?: number;
          data?: number[];
        }>;
      };

      const series = data.result?.[0];
      const count = series?.count ?? (series?.data ?? []).reduce((a, b) => a + b, 0);

      // Fetch unique users with dau math
      const uniqueBody = {
        insight: "TRENDS",
        events: [
          {
            id: eventName,
            math: "dau",
          },
        ],
        date_from: dateRange.start,
        date_to: dateRange.end,
      };

      const uniqueRes = await fetch(
        `${base}/api/projects/${credentials.projectId}/insights/trend/`,
        {
          method: "POST",
          headers: headers(credentials),
          body: JSON.stringify(uniqueBody),
        }
      );

      let uniqueUsers = 0;
      if (uniqueRes.ok) {
        const uniqueData = (await uniqueRes.json()) as {
          result?: Array<{ count?: number; data?: number[] }>;
        };
        const uniqueSeries = uniqueData.result?.[0];
        uniqueUsers = uniqueSeries?.count ?? (uniqueSeries?.data ?? []).reduce((a, b) => a + b, 0);
      }

      results.push({ eventName, count, uniqueUsers });
    }

    return results;
  }

  async getFunnelData(
    credentials: AnalyticsCredentials,
    funnelSteps: string[],
    dateRange: DateRange
  ): Promise<FunnelData> {
    const base = baseUrl(credentials);
    const body = {
      insight: "FUNNELS",
      events: funnelSteps.map((step, i) => ({
        id: step,
        order: i,
      })),
      date_from: dateRange.start,
      date_to: dateRange.end,
      funnel_window_days: 14,
    };

    const res = await fetch(
      `${base}/api/projects/${credentials.projectId}/insights/funnel/`,
      {
        method: "POST",
        headers: headers(credentials),
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PostHog funnel failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as {
      result?: Array<{
        name?: string;
        count?: number;
        order?: number;
      }>;
    };

    const rawSteps = (data.result ?? []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const steps = rawSteps.map((step, i) => {
      const count = step.count ?? 0;
      const prevCount = i > 0 ? (rawSteps[i - 1].count ?? 0) : count;
      return {
        name: step.name ?? funnelSteps[i] ?? `Step ${i + 1}`,
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
    const base = baseUrl(credentials);
    const body = {
      insight: "TRENDS",
      events: [
        {
          id: "$pageview",
          math: "total",
        },
      ],
      breakdown: "$referring_domain",
      breakdown_type: "event",
      date_from: dateRange.start,
      date_to: dateRange.end,
    };

    const res = await fetch(
      `${base}/api/projects/${credentials.projectId}/insights/trend/`,
      {
        method: "POST",
        headers: headers(credentials),
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PostHog traffic sources failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as {
      result?: Array<{
        breakdown_value?: string;
        count?: number;
        data?: number[];
      }>;
    };

    return (data.result ?? []).map((series) => {
      const totalSessions = series.count ?? (series.data ?? []).reduce((a, b) => a + b, 0);
      return {
        source: series.breakdown_value ?? "(direct)",
        medium: "referral",
        sessions: totalSessions,
        conversions: 0, // PostHog doesn't natively expose conversions per source in this query
        revenue: 0,
      };
    });
  }
}

export const posthogAdapter = new PostHogAdapter();
