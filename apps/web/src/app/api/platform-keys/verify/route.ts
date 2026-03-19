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
    keys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN"],
    labels: {
      GOOGLE_CLIENT_ID: "Client ID",
      GOOGLE_CLIENT_SECRET: "Client Secret",
      GOOGLE_ADS_DEVELOPER_TOKEN: "Developer Token",
    },
    oauthRequired: true,
  },
  meta: {
    keys: ["META_CLIENT_ID", "META_CLIENT_SECRET"],
    labels: {
      META_CLIENT_ID: "App ID",
      META_CLIENT_SECRET: "App Secret",
    },
    oauthRequired: true,
  },
  tiktok: {
    keys: ["TIKTOK_CLIENT_ID", "TIKTOK_CLIENT_SECRET"],
    labels: {
      TIKTOK_CLIENT_ID: "App ID",
      TIKTOK_CLIENT_SECRET: "App Secret",
    },
    oauthRequired: true,
  },
  x: {
    keys: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
    labels: {
      X_CLIENT_ID: "Client ID",
      X_CLIENT_SECRET: "Client Secret",
    },
    oauthRequired: true,
  },
  linkedin: {
    keys: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    labels: {
      LINKEDIN_CLIENT_ID: "Client ID",
      LINKEDIN_CLIENT_SECRET: "Client Secret",
    },
    oauthRequired: true,
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
