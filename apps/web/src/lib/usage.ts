/**
 * Usage reporting utility for the main Kalit app.
 *
 * Reports credit-consuming actions (campaign creation, content generation, etc.)
 * back to the main app so it can track entitlement usage.
 *
 * Environment variables:
 *   MAIN_APP_URL   - Base URL of the main Kalit app (e.g. https://kalit.ai)
 *   SUITE_API_KEY  - Shared secret for authenticating suite-to-main API calls
 */

export interface UsageReportParams {
  /** externalUserId from the main app */
  userId: string;
  /** externalOrgId from the main app */
  orgId: string;
  /** Action identifier (e.g. "campaign.create", "content.generate") */
  action: string;
  /** Number of credits to debit */
  credits: number;
  /** Optional metadata about the action */
  metadata?: Record<string, unknown>;
}

export async function reportUsage(
  params: UsageReportParams,
): Promise<{ success: boolean; error?: string }> {
  const mainAppUrl = process.env.MAIN_APP_URL;
  const apiKey = process.env.SUITE_API_KEY;

  if (!mainAppUrl || !apiKey) {
    // Usage reporting is optional in dev/standalone mode
    console.warn(
      "[usage] Skipping usage report: MAIN_APP_URL or SUITE_API_KEY not configured",
    );
    return { success: false, error: "Usage reporting not configured" };
  }

  try {
    const response = await fetch(`${mainAppUrl}/api/usage/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        userId: params.userId,
        orgId: params.orgId,
        action: params.action,
        credits: params.credits,
        metadata: params.metadata,
        suite: "marketing",
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "unknown error");
      console.error(
        `[usage] Report failed (${response.status}): ${text}`,
      );
      return { success: false, error: `HTTP ${response.status}: ${text}` };
    }

    return { success: true };
  } catch (err) {
    console.error("[usage] Report failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
