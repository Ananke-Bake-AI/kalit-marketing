/**
 * OAuth Provider Configurations
 *
 * Centralised OAuth config for all supported platforms.
 * Client IDs and secrets are sourced from environment variables.
 */

export interface OAuthProviderConfig {
  platform: string;
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  additionalParams?: Record<string, string>;
}

const providers: Record<string, () => OAuthProviderConfig> = {
  meta: () => ({
    platform: "meta",
    authorizationUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    clientId: process.env.META_CLIENT_ID ?? "",
    clientSecret: process.env.META_CLIENT_SECRET ?? "",
    scopes: [
      "ads_management",
      "ads_read",
      "pages_manage_posts",
      "instagram_basic",
      "instagram_content_publish",
    ],
  }),

  google: () => ({
    platform: "google",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    scopes: [
      "https://www.googleapis.com/auth/adwords",
      "https://www.googleapis.com/auth/analytics.readonly",
    ],
    additionalParams: {
      access_type: "offline",
      prompt: "consent",
    },
  }),

  tiktok: () => ({
    platform: "tiktok",
    authorizationUrl: "https://business-api.tiktok.com/portal/auth",
    tokenUrl: "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
    clientId: process.env.TIKTOK_CLIENT_ID ?? "",
    clientSecret: process.env.TIKTOK_CLIENT_SECRET ?? "",
    scopes: ["ad_management", "creative_management"],
    additionalParams: {
      app_id: process.env.TIKTOK_CLIENT_ID ?? "",
    },
  }),

  x: () => ({
    platform: "x",
    authorizationUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    clientId: process.env.X_CLIENT_ID ?? "",
    clientSecret: process.env.X_CLIENT_SECRET ?? "",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    additionalParams: {
      code_challenge_method: "S256",
    },
  }),

  linkedin: () => ({
    platform: "linkedin",
    authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    clientId: process.env.LINKEDIN_CLIENT_ID ?? "",
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
    scopes: [
      "r_liteprofile",
      "r_ads",
      "rw_ads",
      "w_member_social",
      "r_organization_social",
      "w_organization_social",
    ],
  }),

  reddit: () => ({
    platform: "reddit",
    authorizationUrl: "https://www.reddit.com/api/v1/authorize",
    tokenUrl: "https://www.reddit.com/api/v1/access_token",
    clientId: process.env.REDDIT_CLIENT_ID ?? "",
    clientSecret: process.env.REDDIT_CLIENT_SECRET ?? "",
    scopes: ["submit", "edit", "read", "identity"],
    additionalParams: {
      duration: "permanent",
    },
  }),

  hubspot: () => ({
    platform: "hubspot",
    authorizationUrl: "https://app.hubspot.com/oauth/authorize",
    tokenUrl: "https://api.hubapi.com/oauth/v1/token",
    clientId: process.env.HUBSPOT_CLIENT_ID ?? "",
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET ?? "",
    scopes: [
      "crm.objects.contacts.read",
      "crm.objects.contacts.write",
      "crm.objects.deals.read",
      "crm.objects.deals.write",
    ],
  }),
};

/**
 * Get the OAuth configuration for a given platform.
 * Returns null if the platform is not supported.
 */
export function getOAuthConfig(platform: string): OAuthProviderConfig | null {
  const factory = providers[platform];
  if (!factory) return null;
  return factory();
}

/**
 * List all supported OAuth platforms.
 */
export function getSupportedPlatforms(): string[] {
  return Object.keys(providers);
}
