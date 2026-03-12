import type {
  AnalyticsAdapter,
  AnalyticsCredentials,
  DateRange,
  EventCountData,
  FunnelData,
  TrafficSourceData,
} from "./analytics-types";

function authHeaders(credentials: AnalyticsCredentials): HeadersInit {
  if (credentials.accessToken) {
    return {
      Authorization: `Bearer ${credentials.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }
  // Basic auth with API secret
  const encoded = btoa(`${credentials.apiKey}:`);
  return {
    Authorization: `Basic ${encoded}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export class MixpanelAdapter implements AnalyticsAdapter {
  platform = "mixpanel";

  async validateCredentials(credentials: AnalyticsCredentials): Promise<boolean> {
    try {
      const url = `https://mixpanel.com/api/app/me`;
      const res = await fetch(url, { headers: authHeaders(credentials) });
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
    const results: EventCountData[] = [];

    for (const eventName of events) {
      const params = new URLSearchParams({
        from_date: dateRange.start,
        to_date: dateRange.end,
        event: JSON.stringify([eventName]),
      });

      const res = await fetch(
        `https://mixpanel.com/api/2.0/events?${params.toString()}`,
        { headers: authHeaders(credentials) }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Mixpanel events query failed (${res.status}): ${text}`);
      }

      const data = (await res.json()) as {
        data?: {
          values?: Record<string, Record<string, number>>;
        };
      };

      const eventValues = data.data?.values?.[eventName] ?? {};
      const count = Object.values(eventValues).reduce((sum, v) => sum + v, 0);

      // Unique users via insights endpoint
      const insightParams = new URLSearchParams({
        from_date: dateRange.start,
        to_date: dateRange.end,
      });

      const insightBody = {
        event: eventName,
        type: "unique",
      };

      const insightRes = await fetch(
        `https://mixpanel.com/api/2.0/insights?${insightParams.toString()}`,
        {
          method: "POST",
          headers: authHeaders(credentials),
          body: JSON.stringify(insightBody),
        }
      );

      let uniqueUsers = 0;
      if (insightRes.ok) {
        const insightData = (await insightRes.json()) as {
          series?: Record<string, Record<string, number>>;
        };
        const seriesValues = insightData.series?.[eventName] ?? {};
        uniqueUsers = Object.values(seriesValues).reduce((sum, v) => sum + v, 0);
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
    // Mixpanel requires funnels to be created first via the UI or API.
    // We create an ad-hoc funnel query.
    const body = {
      from_date: dateRange.start,
      to_date: dateRange.end,
      events: funnelSteps.map((step) => ({ event: step })),
    };

    const res = await fetch("https://mixpanel.com/api/2.0/funnels", {
      method: "POST",
      headers: authHeaders(credentials),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Mixpanel funnels failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as {
      data?: {
        steps?: Array<{
          event?: string;
          count?: number;
          step_conv_ratio?: number;
        }>;
        overall_conv_ratio?: number;
      };
    };

    const rawSteps = data.data?.steps ?? [];

    const steps = rawSteps.map((step, i) => {
      const count = step.count ?? 0;
      const prevCount = i > 0 ? (rawSteps[i - 1].count ?? 0) : count;
      return {
        name: step.event ?? funnelSteps[i] ?? `Step ${i + 1}`,
        count,
        dropoff: i === 0 ? 0 : prevCount > 0 ? (prevCount - count) / prevCount : 0,
      };
    });

    const overallConversion = data.data?.overall_conv_ratio ?? 0;

    return { steps, overallConversion };
  }

  async getTrafficSources(
    credentials: AnalyticsCredentials,
    dateRange: DateRange
  ): Promise<TrafficSourceData[]> {
    // Query pageview events segmented by utm_source and utm_medium
    const params = new URLSearchParams({
      from_date: dateRange.start,
      to_date: dateRange.end,
      event: JSON.stringify(["$mp_web_page_view"]),
      on: JSON.stringify('properties["utm_source"]'),
    });

    const res = await fetch(
      `https://mixpanel.com/api/2.0/events/properties?${params.toString()}`,
      { headers: authHeaders(credentials) }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Mixpanel traffic sources failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as {
      data?: {
        values?: Record<string, Record<string, number>>;
      };
    };

    const values = data.data?.values ?? {};
    return Object.entries(values).map(([source, dateValues]) => {
      const sessions = Object.values(dateValues).reduce((sum, v) => sum + v, 0);
      return {
        source: source || "(direct)",
        medium: "unknown",
        sessions,
        conversions: 0,
        revenue: 0,
      };
    });
  }
}

export const mixpanelAdapter = new MixpanelAdapter();
