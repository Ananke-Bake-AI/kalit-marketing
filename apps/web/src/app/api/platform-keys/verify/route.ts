/**
 * Platform Keys Verification API
 *
 * POST /api/platform-keys/verify
 * Body: { platform: "google" | "meta" | ... }
 *
 * Checks if the required credentials are configured for a given platform.
 * For OAuth platforms, also checks if a connected account exists.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPlatformKey } from "@/lib/platform-keys";
import { prisma } from "@kalit/db";

interface PlatformRequirement {
  keys: string[];
  labels: Record<string, string>;
  oauthRequired?: boolean;
}

const platformRequirements: Record<string, PlatformRequirement> = {
  google: {
    keys: ["GOOGLE_SERVICE_ACCOUNT_KEY", "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"],
    labels: {
      GOOGLE_SERVICE_ACCOUNT_KEY: "Service Account Key",
      GOOGLE_ADS_DEVELOPER_TOKEN: "Developer Token",
      GOOGLE_ADS_CUSTOMER_ID: "Customer ID",
    },
  },
  meta: {
    keys: ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"],
    labels: {
      META_ACCESS_TOKEN: "System User Token",
      META_AD_ACCOUNT_ID: "Ad Account ID",
    },
  },
  tiktok: {
    keys: ["TIKTOK_ACCESS_TOKEN", "TIKTOK_ADVERTISER_ID"],
    labels: {
      TIKTOK_ACCESS_TOKEN: "Access Token",
      TIKTOK_ADVERTISER_ID: "Advertiser ID",
    },
  },
  x: {
    keys: [],
    labels: {},
    // X uses browser extension — no API keys or OAuth needed
  },
  linkedin: {
    keys: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    labels: {
      LINKEDIN_CLIENT_ID: "Client ID",
      LINKEDIN_CLIENT_SECRET: "Client Secret",
    },
    oauthRequired: true, // LinkedIn is the only platform that requires OAuth
  },
  anthropic: {
    keys: ["ANTHROPIC_API_KEY"],
    labels: {
      ANTHROPIC_API_KEY: "API Key",
    },
  },
  encryption: {
    keys: ["ENCRYPTION_KEY"],
    labels: {
      ENCRYPTION_KEY: "Encryption Key",
    },
  },
};

export async function POST(req: NextRequest) {
  const { platform, workspaceId } = await req.json();

  const requirements = platformRequirements[platform];
  if (!requirements) {
    return NextResponse.json(
      { error: `Unknown platform: ${platform}` },
      { status: 400 }
    );
  }

  const keyStatuses: Record<string, boolean> = {};
  for (const key of requirements.keys) {
    const value = getPlatformKey(key);
    keyStatuses[key] = !!value;
  }

  const allKeysConfigured = Object.values(keyStatuses).every(Boolean);

  // Check OAuth connection if applicable
  let oauthConnected = false;
  let accountName: string | null = null;

  if (requirements.oauthRequired && workspaceId) {
    try {
      const account = await prisma.connectedAccount.findFirst({
        where: {
          workspaceId,
          platform,
          isActive: true,
        },
      });
      if (account) {
        oauthConnected = true;
        accountName = account.accountName;
      }
    } catch {
      // DB not available — skip
    }
  }

  return NextResponse.json({
    platform,
    keysConfigured: keyStatuses,
    allKeysConfigured,
    oauthRequired: requirements.oauthRequired ?? false,
    oauthConnected,
    accountName,
    ready: allKeysConfigured && (!requirements.oauthRequired || oauthConnected),
  });
}
