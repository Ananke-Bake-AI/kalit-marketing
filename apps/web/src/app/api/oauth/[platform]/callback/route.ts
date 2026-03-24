/**
 * OAuth Callback Route
 *
 * GET /api/oauth/[platform]/callback?code=xxx&state=xxx
 *
 * Exchanges the authorization code for tokens, verifies CSRF state,
 * and persists the ConnectedAccount in the database.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kalit/db";
import { getOAuthConfig } from "@/lib/oauth/providers";
import { encryptJson } from "@/lib/crypto/encrypt";

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

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    const errorDescription =
      request.nextUrl.searchParams.get("error_description") ?? error;
    return NextResponse.redirect(
      new URL(
        `/dashboard/connections?error=${encodeURIComponent(errorDescription)}`,
        request.url
      )
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state parameter" },
      { status: 400 }
    );
  }

  // Verify state matches cookie (CSRF protection)
  const cookieState = request.cookies.get(`oauth_state_${platform}`)?.value;
  if (!cookieState || cookieState !== state) {
    return NextResponse.json(
      { error: "State mismatch — possible CSRF attack" },
      { status: 403 }
    );
  }

  // Extract workspaceId from state (format: "nonce:workspaceId")
  const colonIdx = state.indexOf(":");
  if (colonIdx === -1) {
    return NextResponse.json(
      { error: "Invalid state format" },
      { status: 400 }
    );
  }
  const workspaceId = state.substring(colonIdx + 1);

  // Exchange code for tokens
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXTAUTH_URL ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  const redirectUri = `${baseUrl}/api/oauth/${platform}/callback`;

  // Retrieve PKCE code_verifier from cookie (if platform requires it)
  const codeVerifier = request.cookies.get(`oauth_pkce_${platform}`)?.value ?? undefined;

  try {
    const tokenData = await exchangeCodeForTokens(
      config,
      code,
      redirectUri,
      platform,
      codeVerifier
    );

    // Fetch account info from platform (best-effort)
    const accountInfo = await fetchAccountInfo(platform, tokenData.accessToken);

    // Build credentials payload
    const credentials = encryptJson({
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      expiresAt: tokenData.expiresAt,
    });

    // Map platform string to Prisma Platform enum value
    const platformEnum = mapToPrismaEnum(platform);

    // Upsert ConnectedAccount
    await prisma.connectedAccount.upsert({
      where: {
        workspaceId_platform_accountId: {
          workspaceId,
          platform: platformEnum,
          accountId: accountInfo.accountId,
        },
      },
      update: {
        credentials: credentials,
        scopes: config.scopes,
        accountName: accountInfo.accountName,
        isActive: true,
        metadata: (accountInfo.metadata as Record<string, string>) ?? undefined,
      },
      create: {
        workspaceId,
        platform: platformEnum,
        accountId: accountInfo.accountId,
        accountName: accountInfo.accountName,
        credentials: credentials,
        scopes: config.scopes,
        isActive: true,
        metadata: (accountInfo.metadata as Record<string, string>) ?? undefined,
      },
    });

    // Clear state and PKCE cookies, redirect to success
    const response = NextResponse.redirect(
      new URL(`/dashboard/connections?connected=${platform}`, request.url)
    );
    response.cookies.delete(`oauth_state_${platform}`);
    response.cookies.delete(`oauth_pkce_${platform}`);
    return response;
  } catch (err) {
    console.error(`[OAuth Callback] ${platform} error:`, err);
    const message =
      err instanceof Error ? err.message : "Unknown error during OAuth callback";
    return NextResponse.redirect(
      new URL(
        `/dashboard/connections?error=${encodeURIComponent(message)}`,
        request.url
      )
    );
  }
}

// ============================================================
// Internal helpers
// ============================================================

interface TokenExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

async function exchangeCodeForTokens(
  config: {
    platform: string;
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
  },
  code: string,
  redirectUri: string,
  platform: string,
  codeVerifier?: string
): Promise<TokenExchangeResult> {
  const bodyParams: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  };

  // X (Twitter) uses PKCE — include code_verifier and use Basic Auth
  if (codeVerifier) {
    bodyParams.code_verifier = codeVerifier;
  }

  const body = new URLSearchParams(bodyParams);

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  // Reddit and X require Basic Auth for token exchange
  if (platform === "reddit" || platform === "x") {
    const basic = Buffer.from(
      `${config.clientId}:${config.clientSecret}`
    ).toString("base64");
    headers["Authorization"] = `Basic ${basic}`;
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Token exchange failed for ${platform}: ${response.status} — ${text}`
    );
  }

  const data = (await response.json()) as Record<string, unknown>;

  const accessToken =
    (data.access_token as string) ?? (data.accessToken as string);
  const refreshToken =
    (data.refresh_token as string) ??
    (data.refreshToken as string) ??
    undefined;
  const expiresIn =
    (data.expires_in as number) ?? (data.expiresIn as number) ?? 3600;

  return {
    accessToken,
    refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
  };
}

interface AccountInfoResult {
  accountId: string;
  accountName?: string;
  metadata?: Record<string, unknown>;
}

async function fetchAccountInfo(
  platform: string,
  accessToken: string
): Promise<AccountInfoResult> {
  try {
    switch (platform) {
      case "meta": {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`
        );
        const data = (await res.json()) as { id: string; name: string };
        return { accountId: data.id, accountName: data.name };
      }
      case "google": {
        // Try userinfo first — may fail if openid scope not included
        const res = await fetch(
          "https://www.googleapis.com/oauth2/v2/userinfo",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (res.ok) {
          const data = (await res.json()) as { id?: string; name?: string; email?: string };
          if (data.id) {
            return { accountId: data.id, accountName: data.name ?? data.email ?? "Google Account" };
          }
        }
        // Fallback: use a stable identifier from the token hash
        return {
          accountId: `google_${Buffer.from(accessToken.slice(-16)).toString("hex").slice(0, 12)}`,
          accountName: "Google Account",
        };
      }
      case "x": {
        const res = await fetch("https://api.twitter.com/2/users/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = (await res.json()) as {
          data: { id: string; name: string; username: string };
        };
        return {
          accountId: data.data.id,
          accountName: data.data.username,
        };
      }
      case "linkedin": {
        const res = await fetch("https://api.linkedin.com/v2/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = (await res.json()) as {
          id: string;
          localizedFirstName: string;
          localizedLastName: string;
        };
        return {
          accountId: data.id,
          accountName: `${data.localizedFirstName} ${data.localizedLastName}`,
        };
      }
      case "reddit": {
        const res = await fetch("https://oauth.reddit.com/api/v1/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = (await res.json()) as { id: string; name: string };
        return { accountId: data.id, accountName: data.name };
      }
      case "tiktok": {
        // TikTok returns advertiser info in the token response metadata
        return {
          accountId: `tiktok_${Date.now()}`,
          accountName: "TikTok Business",
        };
      }
      case "hubspot": {
        const res = await fetch(
          "https://api.hubapi.com/oauth/v1/access-tokens/" + accessToken
        );
        const data = (await res.json()) as {
          hub_id: number;
          user: string;
        };
        return {
          accountId: String(data.hub_id),
          accountName: data.user,
          metadata: { portalId: String(data.hub_id) },
        };
      }
      default:
        return { accountId: `${platform}_${Date.now()}` };
    }
  } catch {
    // If account info fetch fails, use a fallback ID
    return { accountId: `${platform}_${Date.now()}` };
  }
}

function mapToPrismaEnum(
  platform: string
): "meta" | "google" | "tiktok" | "linkedin" | "x" | "reddit" | "hubspot" {
  const valid = [
    "meta",
    "google",
    "tiktok",
    "linkedin",
    "x",
    "reddit",
    "hubspot",
  ] as const;
  const found = valid.find((v) => v === platform);
  if (!found) {
    throw new Error(`Cannot map platform "${platform}" to Prisma enum`);
  }
  return found;
}
