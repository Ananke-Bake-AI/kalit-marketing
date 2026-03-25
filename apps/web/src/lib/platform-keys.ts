/**
 * Platform API Keys — File-based storage
 *
 * Stores platform OAuth client IDs, secrets, and API tokens in a local
 * JSON file. This allows configuring credentials from the dashboard UI
 * instead of manually editing .env files.
 *
 * Read order: saved keys → environment variables → empty string
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const KEYS_DIR = join(process.cwd(), ".credentials");
const KEYS_FILE = join(KEYS_DIR, "platform-keys.json");

export interface PlatformKeys {
  // Google
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_ADS_DEVELOPER_TOKEN?: string;
  // Meta
  META_CLIENT_ID?: string;
  META_CLIENT_SECRET?: string;
  // TikTok
  TIKTOK_CLIENT_ID?: string;
  TIKTOK_CLIENT_SECRET?: string;
  // X
  X_CLIENT_ID?: string;
  X_CLIENT_SECRET?: string;
  // LinkedIn
  LINKEDIN_CLIENT_ID?: string;
  LINKEDIN_CLIENT_SECRET?: string;
  // Reddit
  REDDIT_CLIENT_ID?: string;
  REDDIT_CLIENT_SECRET?: string;
  // HubSpot
  HUBSPOT_CLIENT_ID?: string;
  HUBSPOT_CLIENT_SECRET?: string;
  // Encryption
  ENCRYPTION_KEY?: string;
  // AI
  ANTHROPIC_API_KEY?: string;
  // Image gen
  IMAGE_GEN_PROVIDER?: string;
  FAL_KEY?: string;
  OPENAI_API_KEY?: string;
  // Other
  [key: string]: string | undefined;
}

/**
 * Read all saved platform keys from disk.
 */
export function readPlatformKeys(): PlatformKeys {
  try {
    if (!existsSync(KEYS_FILE)) return {};
    const raw = readFileSync(KEYS_FILE, "utf-8");
    return JSON.parse(raw) as PlatformKeys;
  } catch {
    return {};
  }
}

/**
 * Write platform keys to disk (merge with existing).
 */
export function writePlatformKeys(updates: PlatformKeys): PlatformKeys {
  const existing = readPlatformKeys();

  // Merge — delete keys set to empty string
  const merged = { ...existing };
  for (const [key, value] of Object.entries(updates)) {
    if (value === "" || value === undefined) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }

  // Ensure directory exists
  if (!existsSync(KEYS_DIR)) {
    mkdirSync(KEYS_DIR, { recursive: true });
  }

  writeFileSync(KEYS_FILE, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}

/**
 * Get a key value from saved keys OR environment variables.
 */
export function getKey(key: string): string | undefined {
  const keys = readPlatformKeys();
  return keys[key] || process.env[key] || undefined;
}

/**
 * Detect which ad platforms are connected based on configured credentials.
 * Returns a list of platform IDs that have the required keys set up.
 */
export function getConnectedAdPlatforms(): string[] {
  const platforms: string[] = [];

  // Google Ads — needs service account key + developer token
  if (getKey("GOOGLE_SERVICE_ACCOUNT_KEY") && getKey("GOOGLE_ADS_DEVELOPER_TOKEN")) {
    platforms.push("google");
  }

  // Meta — needs system user token + ad account ID
  if (getKey("META_ACCESS_TOKEN") && getKey("META_AD_ACCOUNT_ID")) {
    platforms.push("meta");
  }

  // TikTok — needs access token + advertiser ID
  if (getKey("TIKTOK_ACCESS_TOKEN") && getKey("TIKTOK_ADVERTISER_ID")) {
    platforms.push("tiktok");
  }

  // X (Twitter) — uses browser extension, always "connected" (no keys needed)
  // We check for the extension on the client side, but for campaign generation
  // we include X since deployment is handled by the extension
  platforms.push("x");

  // LinkedIn — needs OAuth client ID + secret
  if (getKey("LINKEDIN_CLIENT_ID") && getKey("LINKEDIN_CLIENT_SECRET")) {
    platforms.push("linkedin");
  }

  return platforms;
}

/**
 * Get a platform key value.
 * Priority: saved file → environment variable → fallback
 */
export function getPlatformKey(key: string, fallback: string = ""): string {
  const saved = readPlatformKeys();
  if (saved[key]) return saved[key]!;
  if (process.env[key]) return process.env[key]!;
  return fallback;
}
