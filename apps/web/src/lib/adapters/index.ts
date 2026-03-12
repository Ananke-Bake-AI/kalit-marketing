export type { ChannelAdapter, AdCredentials, PerformanceData, CampaignSpec, AdGroupSpec, AdSpec, DateRange } from "./types";
export { metaAdapter } from "./meta";
export { googleAdapter } from "./google";
export { MockAdapter, mockAdapter } from "./mock";

import type { ChannelAdapter } from "./types";
import { metaAdapter } from "./meta";
import { googleAdapter } from "./google";
import { MockAdapter } from "./mock";

const adapters: Record<string, ChannelAdapter> = {
  meta: metaAdapter,
  google: googleAdapter,
};

/**
 * Get the appropriate channel adapter for a platform.
 * If MOCK_ADAPTERS=true, returns a MockAdapter for all platforms.
 */
export function getAdapter(platform: string): ChannelAdapter | null {
  if (process.env.MOCK_ADAPTERS === "true") {
    return new MockAdapter(platform);
  }
  return adapters[platform] ?? null;
}
