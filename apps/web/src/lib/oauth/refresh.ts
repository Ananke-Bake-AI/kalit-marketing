/**
 * OAuth Token Refresh
 *
 * Refreshes expired access tokens using stored refresh tokens.
 * Updates the ConnectedAccount record with fresh credentials.
 */

import { prisma } from "@kalit/db";
import { getOAuthConfig } from "./providers";
import { encryptJson, decryptJson } from "../crypto/encrypt";

interface StoredCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Unix timestamp
  [key: string]: unknown;
}

/**
 * Get valid credentials for a connected account.
 * Automatically refreshes the token if expired or about to expire (within 5 min).
 */
export async function getValidCredentials(
  accountId: string
): Promise<StoredCredentials> {
  const account = await prisma.connectedAccount.findUniqueOrThrow({
    where: { id: accountId },
  });

  const creds = decryptJson<StoredCredentials>(
    account.credentials as string
  );

  // Check if token is still valid (with 5 min buffer)
  const now = Math.floor(Date.now() / 1000);
  const bufferSeconds = 300;

  if (creds.expiresAt && creds.expiresAt > now + bufferSeconds) {
    return creds;
  }

  // No refresh token → return as-is (Meta long-lived tokens, API keys, etc.)
  if (!creds.refreshToken) {
    return creds;
  }

  // Refresh the token
  const provider = getOAuthConfig(account.platform);
  if (!provider) {
    console.warn(`[refresh] No OAuth config for platform: ${account.platform}`);
    return creds;
  }

  const refreshed = await refreshAccessToken(
    provider.tokenUrl,
    provider.clientId,
    provider.clientSecret,
    creds.refreshToken
  );

  const updatedCreds: StoredCredentials = {
    ...creds,
    accessToken: refreshed.access_token,
    expiresAt: refreshed.expires_in
      ? now + refreshed.expires_in
      : undefined,
  };

  // Some providers rotate refresh tokens
  if (refreshed.refresh_token) {
    updatedCreds.refreshToken = refreshed.refresh_token;
  }

  // Persist updated credentials
  await prisma.connectedAccount.update({
    where: { id: accountId },
    data: {
      credentials: encryptJson(updatedCreds) as unknown as object,
      lastSyncAt: new Date(),
    },
  });

  return updatedCreds;
}

async function refreshAccessToken(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Token refresh failed (${res.status}): ${text}`
    );
  }

  return res.json();
}
