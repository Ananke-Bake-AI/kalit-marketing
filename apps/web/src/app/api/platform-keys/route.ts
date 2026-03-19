/**
 * Platform Keys API
 *
 * GET  — Read all saved platform credentials (values masked)
 * PUT  — Update platform credentials
 */

import { NextRequest, NextResponse } from "next/server";
import { readPlatformKeys, writePlatformKeys } from "@/lib/platform-keys";

function maskValue(value: string): string {
  if (value.length <= 8) return "••••••••";
  return value.slice(0, 4) + "••••" + value.slice(-4);
}

export async function GET() {
  const keys = readPlatformKeys();

  // Return masked values so the UI can show what's configured
  const masked: Record<string, { set: boolean; masked: string }> = {};
  for (const [key, value] of Object.entries(keys)) {
    if (value) {
      masked[key] = { set: true, masked: maskValue(value) };
    }
  }

  // Also check env vars for keys not saved to file
  const envKeys = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "META_CLIENT_ID",
    "META_CLIENT_SECRET",
    "TIKTOK_CLIENT_ID",
    "TIKTOK_CLIENT_SECRET",
    "X_CLIENT_ID",
    "X_CLIENT_SECRET",
    "LINKEDIN_CLIENT_ID",
    "LINKEDIN_CLIENT_SECRET",
    "REDDIT_CLIENT_ID",
    "REDDIT_CLIENT_SECRET",
    "HUBSPOT_CLIENT_ID",
    "HUBSPOT_CLIENT_SECRET",
    "ENCRYPTION_KEY",
    "ANTHROPIC_API_KEY",
  ];

  for (const key of envKeys) {
    if (!masked[key] && process.env[key]) {
      masked[key] = { set: true, masked: maskValue(process.env[key]!) };
    }
  }

  return NextResponse.json(masked);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updated = writePlatformKeys(body);

  return NextResponse.json({
    success: true,
    keysConfigured: Object.keys(updated).length,
  });
}
