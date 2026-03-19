const MAIN_APP_URL = process.env.MAIN_APP_URL;
const SUITE_API_KEY = process.env.SUITE_API_KEY;

interface UsageReport {
  externalUserId: string;
  externalOrgId: string;
  action: string;
  credits: number;
  metadata?: Record<string, unknown>;
}

/**
 * Report usage back to the main app (kalit.ai).
 * Fire-and-forget — logs errors but never throws.
 */
export function reportUsage(report: UsageReport): void {
  if (!MAIN_APP_URL || !SUITE_API_KEY) return;

  fetch(`${MAIN_APP_URL}/api/usage/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUITE_API_KEY}`,
    },
    body: JSON.stringify({
      suite: "marketing",
      ...report,
      timestamp: new Date().toISOString(),
    }),
  }).catch((err) => {
    console.error("[usage-reporter] Failed to report usage:", err.message);
  });
}

/**
 * Check if the org has sufficient credits for an operation.
 * Returns true if credits are available or if main app is not configured (standalone mode).
 */
export async function checkCredits(
  externalOrgId: string,
  requiredCredits: number
): Promise<{ allowed: boolean; remaining?: number; error?: string }> {
  if (!MAIN_APP_URL || !SUITE_API_KEY) {
    return { allowed: true }; // Standalone/dev mode
  }

  try {
    const res = await fetch(
      `${MAIN_APP_URL}/api/suite/credits?orgId=${encodeURIComponent(externalOrgId)}`,
      {
        headers: { Authorization: `Bearer ${SUITE_API_KEY}` },
      }
    );

    if (!res.ok) {
      console.error(`[usage-reporter] Credit check failed: ${res.status}`);
      return { allowed: true }; // Fail open — don't block on main app errors
    }

    const data = await res.json();
    const remaining = data.remaining ?? Infinity;

    if (remaining < requiredCredits) {
      return {
        allowed: false,
        remaining,
        error: `Insufficient credits: ${remaining} remaining, ${requiredCredits} required`,
      };
    }

    return { allowed: true, remaining };
  } catch (err) {
    console.error("[usage-reporter] Credit check error:", err);
    return { allowed: true }; // Fail open
  }
}
