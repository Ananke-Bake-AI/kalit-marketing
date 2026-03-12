/**
 * Unified Adapter Registry
 *
 * Central index for all platform adapters: ad channels, analytics,
 * revenue, email, CRM, social posting, and image generation.
 *
 * Set MOCK_ADAPTERS=true to use mock implementations across the board.
 */

// ============================================================
// Ad platform adapters
// ============================================================

export type {
  ChannelAdapter,
  AdCredentials,
  AccountInfo,
  CampaignSpec,
  CampaignObjective,
  AdGroupSpec,
  TargetingSpec,
  AdSpec,
  DateRange,
  PerformanceData,
  PlatformCampaignResult,
  PlatformAdGroupResult,
  PlatformAdResult,
} from "./types";

export { metaAdapter } from "./meta";
export { googleAdapter } from "./google";
export { tiktokAdapter } from "./tiktok";
export { xAdapter } from "./x";
export { linkedinAdapter } from "./linkedin";
export { redditAdapter } from "./reddit";
export { MockAdapter, mockAdapter } from "./mock";

// ============================================================
// Analytics adapters
// ============================================================

export type {
  AnalyticsAdapter,
  AnalyticsCredentials,
  EventCountData,
  FunnelData,
  TrafficSourceData,
} from "./analytics-types";

export { ga4Adapter } from "./ga4";
export { posthogAdapter } from "./posthog";
export { mixpanelAdapter } from "./mixpanel";

// ============================================================
// Revenue adapters
// ============================================================

export type {
  RevenueAdapter,
  RevenueCredentials,
  RevenueSummary,
  Transaction,
  TransactionPage,
  SubscriptionMetrics,
  RevenueEvent,
} from "./revenue-types";

export { stripeAdapter } from "./stripe";

// ============================================================
// Email adapters
// ============================================================

export type {
  EmailAdapter,
  EmailCredentials,
  EmailSpec,
  EmailResult,
  ContactSpec,
  EmailStats,
  CrmAdapter,
  CrmCredentials,
  CrmContactSpec,
  CrmContact,
  CrmDealSpec,
  PipelineSummary,
} from "./email-types";

export { resendAdapter } from "./resend";
export { sendgridAdapter } from "./sendgrid";
export { hubspotAdapter } from "./hubspot";

// ============================================================
// Social adapters
// ============================================================

export type {
  SocialPostingAdapter,
  SocialCredentials,
  SocialPostSpec,
  SocialPostResult,
  SocialPostMetrics,
} from "./social-types";

// ============================================================
// Content / Image generation adapters
// ============================================================

export type {
  ImageGenerationAdapter,
  ImageGenerationSpec,
  ImageResult,
} from "./content-types";

// ============================================================
// Imports for factory functions
// ============================================================

import type { ChannelAdapter } from "./types";
import type { AnalyticsAdapter } from "./analytics-types";
import type { RevenueAdapter } from "./revenue-types";
import type { EmailAdapter, CrmAdapter } from "./email-types";
import type { SocialPostingAdapter } from "./social-types";
import type { ImageGenerationAdapter } from "./content-types";

import { metaAdapter } from "./meta";
import { googleAdapter } from "./google";
import { tiktokAdapter } from "./tiktok";
import { xAdapter } from "./x";
import { linkedinAdapter } from "./linkedin";
import { redditAdapter } from "./reddit";
import { MockAdapter } from "./mock";

import { ga4Adapter } from "./ga4";
import { posthogAdapter } from "./posthog";
import { mixpanelAdapter } from "./mixpanel";
import { MockAnalyticsAdapter } from "./analytics-mock";

import { stripeAdapter } from "./stripe";
import { MockRevenueAdapter } from "./revenue-mock";

import { resendAdapter } from "./resend";
import { sendgridAdapter } from "./sendgrid";
import { emailMockAdapter } from "./email-mock";

import { hubspotAdapter } from "./hubspot";

import { metaSocialAdapter } from "./social/meta-social";
import { xSocialAdapter } from "./social/x-social";
import { linkedinSocialAdapter } from "./social/linkedin-social";
import { tiktokSocialAdapter } from "./social/tiktok-social";
import { MockSocialAdapter } from "./social-mock";

import { MockImageAdapter } from "./image-gen/mock";

// ============================================================
// Channel (ad) adapter registry
// ============================================================

const channelAdapters: Record<string, ChannelAdapter> = {
  meta: metaAdapter,
  google: googleAdapter,
  tiktok: tiktokAdapter,
  x: xAdapter,
  linkedin: linkedinAdapter,
  reddit: redditAdapter,
};

/**
 * Get the channel (ad) adapter for a platform.
 * Returns a MockAdapter when MOCK_ADAPTERS=true.
 */
export function getAdapter(platform: string): ChannelAdapter | null {
  if (process.env.MOCK_ADAPTERS === "true") {
    return new MockAdapter(platform);
  }
  return channelAdapters[platform] ?? null;
}

// ============================================================
// Analytics adapter registry
// ============================================================

const analyticsAdapters: Record<string, AnalyticsAdapter> = {
  ga4: ga4Adapter,
  posthog: posthogAdapter,
  mixpanel: mixpanelAdapter,
};

/**
 * Get the analytics adapter for a platform.
 */
export function getAnalyticsAdapter(
  platform: string
): AnalyticsAdapter | null {
  if (process.env.MOCK_ADAPTERS === "true") {
    return new MockAnalyticsAdapter(platform);
  }
  return analyticsAdapters[platform] ?? null;
}

// ============================================================
// Revenue adapter registry
// ============================================================

const revenueAdapters: Record<string, RevenueAdapter> = {
  stripe: stripeAdapter,
};

/**
 * Get the revenue adapter for a platform.
 */
export function getRevenueAdapter(platform: string): RevenueAdapter | null {
  if (process.env.MOCK_ADAPTERS === "true") {
    return new MockRevenueAdapter(platform);
  }
  return revenueAdapters[platform] ?? null;
}

// ============================================================
// Email adapter registry
// ============================================================

const emailAdapters: Record<string, EmailAdapter> = {
  resend: resendAdapter,
  sendgrid: sendgridAdapter,
};

/**
 * Get the email adapter for a platform.
 */
export function getEmailAdapter(platform: string): EmailAdapter | null {
  if (process.env.MOCK_ADAPTERS === "true") {
    return emailMockAdapter;
  }
  return emailAdapters[platform] ?? null;
}

// ============================================================
// CRM adapter registry
// ============================================================

const crmAdapters: Record<string, CrmAdapter> = {
  hubspot: hubspotAdapter,
};

/**
 * Get the CRM adapter for a platform.
 */
export function getCrmAdapter(platform: string): CrmAdapter | null {
  return crmAdapters[platform] ?? null;
}

// ============================================================
// Social posting adapter registry
// ============================================================

const socialAdapters: Record<string, SocialPostingAdapter> = {
  meta: metaSocialAdapter,
  x: xSocialAdapter,
  linkedin: linkedinSocialAdapter,
  tiktok: tiktokSocialAdapter,
};

/**
 * Get the social posting adapter for a platform.
 */
export function getSocialAdapter(
  platform: string
): SocialPostingAdapter | null {
  if (process.env.MOCK_ADAPTERS === "true") {
    return new MockSocialAdapter(platform);
  }
  return socialAdapters[platform] ?? null;
}

// ============================================================
// Image generation adapter
// ============================================================

/**
 * Get the image generation adapter.
 * Checks IMAGE_GEN_PROVIDER env var: "flux" | "dall-e" (default).
 * Returns mock when MOCK_ADAPTERS=true.
 */
export function getImageGenAdapter(): ImageGenerationAdapter {
  if (process.env.MOCK_ADAPTERS === "true") {
    return new MockImageAdapter();
  }

  const provider = process.env.IMAGE_GEN_PROVIDER ?? "dall-e";

  switch (provider) {
    case "flux": {
      const { FluxAdapter } = require("./image-gen/flux") as typeof import("./image-gen/flux");
      return new FluxAdapter();
    }
    case "dall-e":
    default: {
      const { DallEAdapter } = require("./image-gen/dall-e") as typeof import("./image-gen/dall-e");
      return new DallEAdapter();
    }
  }
}
