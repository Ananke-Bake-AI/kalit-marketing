/**
 * OAuth Initiation Route
 *
 * GET /api/oauth/[platform]?workspaceId=xxx
 *
 * Generates a state token, sets it as a cookie, and redirects the user
 * to the platform's authorization URL.
 *
 * For platforms requiring PKCE (e.g. X/Twitter), generates a code_verifier
 * stored in a cookie, and sends the code_challenge in the authorization URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { getOAuthConfig } from "@/lib/oauth/providers";

// Platforms that require PKCE (Proof Key for Code Exchange)
const PKCE_PLATFORMS = new Set(["x"]);

function generateCodeVerifier(): string {
  // RFC 7636: 43-128 chars from [A-Z, a-z, 0-9, "-", ".", "_", "~"]
  return randomBytes(32)
    .toString("base64url")
    .replace(/[^A-Za-z0-9\-._~]/g, "")
    .slice(0, 128);
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

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

  // Apply platform-specific params (except code_challenge_method which we handle below)
  if (config.additionalParams) {
    for (const [key, value] of Object.entries(config.additionalParams)) {
      if (key === "code_challenge_method") continue; // handled by PKCE logic
      authUrl.searchParams.set(key, value);
    }
  }

  // Generate PKCE code_verifier and code_challenge for platforms that require it
  let codeVerifier: string | null = null;
  if (PKCE_PLATFORMS.has(platform)) {
    codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
  }

  const response = NextResponse.redirect(authUrl.toString());

  const isSecure = process.env.NODE_ENV === "production";

  // Store state in an HttpOnly cookie for CSRF verification
  response.cookies.set(`oauth_state_${platform}`, state, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  // Store PKCE code_verifier in a separate cookie for the callback
  if (codeVerifier) {
    response.cookies.set(`oauth_pkce_${platform}`, codeVerifier, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
  }

  return response;
}
