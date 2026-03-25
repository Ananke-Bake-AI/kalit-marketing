/**
 * GET /api/platform-keys/connected
 *
 * Returns which ad platforms have valid credentials configured.
 * Used by the campaign creation UI to know which platforms to generate for.
 */

import { NextResponse } from "next/server";
import { getConnectedAdPlatforms } from "@/lib/platform-keys";

const platformLabels: Record<string, string> = {
  google: "Google Ads",
  meta: "Meta Ads (Facebook & Instagram)",
  tiktok: "TikTok Ads",
  x: "X (Twitter)",
  linkedin: "LinkedIn Ads",
  reddit: "Reddit Ads",
};

export async function GET() {
  const connected = getConnectedAdPlatforms();

  return NextResponse.json({
    connected: connected.map((id) => ({
      id,
      label: platformLabels[id] || id,
    })),
    count: connected.length,
  });
}
