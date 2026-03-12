/**
 * OAuth Initiation Route
 *
 * GET /api/oauth/[platform]?workspaceId=xxx
 *
 * Generates a state token, sets it as a cookie, and redirects the user
 * to the platform's authorization URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getOAuthConfig } from "@/lib/oauth/providers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const config = getOAuthConfig(platform);

  if (!config) {
    return NextResponse.json(
      { error: `Unsupported OAuth platform: ${platform}` },
      { status: 400 }
    );
  }

  const workspaceId =
    request.nextUrl.searchParams.get("workspaceId") ?? "";

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId query parameter is required" },
      { status: 400 }
    );
  }

  // State encodes a random nonce + workspaceId, separated by ":"
  const nonce = randomBytes(16).toString("hex");
  const state = `${nonce}:${workspaceId}`;

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXTAUTH_URL ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  const redirectUri = `${baseUrl}/api/oauth/${platform}/callback`;

  const authUrl = new URL(config.authorizationUrl);
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", config.scopes.join(" "));

  // Apply platform-specific params
  if (config.additionalParams) {
    for (const [key, value] of Object.entries(config.additionalParams)) {
      authUrl.searchParams.set(key, value);
    }
  }

  const response = NextResponse.redirect(authUrl.toString());

  // Store state in an HttpOnly cookie for CSRF verification
  response.cookies.set(`oauth_state_${platform}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
