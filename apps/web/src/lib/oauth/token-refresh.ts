/**
 * OAuth Token Refresh
 *
 * Checks token expiry and automatically refreshes when needed,
 * updating the ConnectedAccount record in the database.
 */

import { prisma } from "@kalit/db";
import { getOAuthConfig } from "./providers";
import { encryptJson, decryptJson } from "../crypto/encrypt";

interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // unix timestamp in seconds
  [key: string]: unknown;
}

interface ConnectedAccountInput {
  id: string;
  platform: string;
  credentials: unknown;
  metadata: unknown;
}

/**
 * Ensure the access token is valid. If expired, refresh it using the
 * platform's OAuth refresh endpoint and persist the new tokens.
 */
export async function refreshTokenIfNeeded(
  connectedAccount: ConnectedAccountInput
): Promise<{ accessToken: string; refreshed: boolean }> {
  const tokenData = parseCredentials(connectedAccount.credentials);

  if (!tokenData.accessToken) {
    throw new Error(
      `No access token found for connected account ${connectedAccount.id}`
    );
  }

  // Check if token is still valid (with 5-minute buffer)
  if (tokenData.expiresAt) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const bufferSeconds = 5 * 60;

    if (tokenData.expiresAt > nowSeconds + bufferSeconds) {
      return { accessToken: tokenData.accessToken, refreshed: false };
    }
  } else {
    // No expiry info — assume it's valid
    return { accessToken: tokenData.accessToken, refreshed: false };
  }

  // Token is expired — attempt refresh
  if (!tokenData.refreshToken) {
    throw new Error(
      `Token expired for account ${connectedAccount.id} but no refresh token available`
    );
  }

  const config = getOAuthConfig(connectedAccount.platform);
  if (!config) {
    throw new Error(
      `No OAuth config for platform: ${connectedAccount.platform}`
    );
  }

  const newTokens = await exchangeRefreshToken(
    config,
    tokenData.refreshToken,
    connectedAccount.platform
  );

  // Merge new tokens into existing credential data
  const updatedTokenData: TokenData = {
    ...tokenData,
    accessToken: newTokens.accessToken,
    expiresAt: newTokens.expiresAt,
  };

  // Keep refresh token — some platforms rotate it, some don't
  if (newTokens.refreshToken) {
    updatedTokenData.refreshToken = newTokens.refreshToken;
  }

  // Persist updated credentials
  await prisma.connectedAccount.update({
    where: { id: connectedAccount.id },
    data: {
      credentials: encryptJson(updatedTokenData),
    },
  });

  return { accessToken: newTokens.accessToken, refreshed: true };
}

// ============================================================
// Internal helpers
// ============================================================

function parseCredentials(credentials: unknown): TokenData {
  if (typeof credentials === "string") {
    try {
      return decryptJson<TokenData>(credentials);
    } catch {
      return JSON.parse(credentials) as TokenData;
    }
  }
  return credentials as TokenData;
}

async function exchangeRefreshToken(
  config: { platform: string; tokenUrl: string; clientId: string; clientSecret: string },
  refreshToken: string,
  platform: string
): Promise<{ accessToken: string; refreshToken?: string; expiresAt: number }> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  // Reddit uses Basic Auth for token requests
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (platform === "reddit") {
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
      `Token refresh failed for ${platform}: ${response.status} ${text}`
    );
  }

  const data = (await response.json()) as Record<string, unknown>;

  const accessToken =
    (data.access_token as string) ?? (data.accessToken as string);
  const newRefreshToken =
    (data.refresh_token as string) ?? (data.refreshToken as string) ?? undefined;
  const expiresIn =
    (data.expires_in as number) ?? (data.expiresIn as number) ?? 3600;

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
  };
}
