/**
 * Campaign Executor
 *
 * The bridge between campaigns in DB and live campaigns on ad platforms.
 * Takes a campaign (with ad groups + creatives), fetches platform credentials,
 * calls the adapter to create everything, and stores platform IDs back.
 */

import { prisma } from "@kalit/db";
import {
  getAdapter,
  type AdCredentials,
  type CampaignSpec,
  type CampaignObjective,
  type AdGroupSpec,
  type AdSpec,
} from "../adapters";
import { getValidCredentials } from "../oauth/refresh";

// ---------- Types ----------

interface ExecutionStep {
  entity: "campaign" | "adGroup" | "ad";
  entityId: string;
  platformId?: string;
  status: "pending" | "success" | "failed";
  error?: string;
}

export interface ExecutionResult {
  campaignId: string;
  platform: string;
  success: boolean;
  platformCampaignId?: string;
  steps: ExecutionStep[];
  error?: string;
}

// ---------- Helpers ----------

function mapObjective(obj: string | null): CampaignObjective {
  const map: Record<string, CampaignObjective> = {
    awareness: "awareness",
    traffic: "traffic",
    engagement: "engagement",
    leads: "leads",
    conversions: "conversions",
    sales: "sales",
    revenue: "sales",
  };
  return map[obj ?? "traffic"] ?? "traffic";
}

function mapCampaignType(type: string): string {
  // Map canonical types to platform support
  const adPlatformTypes: Record<string, string> = {
    paid_search: "google",
    paid_social: "meta",
    display: "google",
    video: "google",
    retargeting: "meta",
  };
  return adPlatformTypes[type] ?? "google";
}

// ---------- Core Executor ----------

/**
 * Execute a single campaign to a specific platform.
 * Creates the campaign, ad groups, and ads on the platform.
 */
export async function executeCampaign(
  campaignId: string,
  platform: string
): Promise<ExecutionResult> {
  const steps: ExecutionStep[] = [];

  try {
    // 1. Load campaign with full hierarchy
    const campaign = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: {
        adGroups: {
          include: {
            creatives: {
              include: {
                creative: {
                  select: {
                    id: true,
                    title: true,
                    content: true,
                    type: true,
                    messagingAngle: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // 2. Get adapter
    const adapter = getAdapter(platform);
    if (!adapter) {
      return {
        campaignId,
        platform,
        success: false,
        steps,
        error: `No adapter found for platform: ${platform}`,
      };
    }

    // 3. Get credentials
    const connectedAccount = await prisma.connectedAccount.findFirst({
      where: {
        workspaceId: campaign.workspaceId,
        platform: platform as never,
        isActive: true,
      },
    });

    if (!connectedAccount) {
      return {
        campaignId,
        platform,
        success: false,
        steps,
        error: `No connected ${platform} account for this workspace`,
      };
    }

    const creds = await getValidCredentials(connectedAccount.id);
    const adCredentials: AdCredentials = {
      accessToken: creds.accessToken,
      refreshToken: creds.refreshToken,
      accountId: connectedAccount.accountId,
      metadata: (connectedAccount.metadata as Record<string, string>) ?? {},
    };

    // 4. Update campaign status to "launching"
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "launching" },
    });

    // 5. Load workspace config for Smart Bidding targets
    const workspaceConfig = await prisma.workspaceConfig.findUnique({
      where: { workspaceId: campaign.workspaceId },
    });

    // Aggregate geo targeting from all ad groups
    const allLocations = new Set<string>();
    for (const ag of campaign.adGroups) {
      const targeting = (ag.targeting as Record<string, unknown>) ?? {};
      const locs = (targeting.locations as string[]) ?? [];
      locs.forEach((l) => allLocations.add(l));
    }

    // Extract base URL from first creative for sitelinks
    let baseUrl = "";
    for (const ag of campaign.adGroups) {
      for (const agc of ag.creatives) {
        const c = (agc.creative.content as Record<string, unknown>) ?? {};
        if (c.destinationUrl) { baseUrl = String(c.destinationUrl); break; }
      }
      if (baseUrl) break;
    }
    const siteOrigin = baseUrl ? new URL(baseUrl).origin : "";

    // Auto-generate sitelinks from the destination domain (Google rewards these)
    const defaultSitelinks = siteOrigin ? [
      { text: "About Us", url: `${siteOrigin}/about`, description1: "Learn more about our team", description2: "Our mission and values" },
      { text: "Pricing", url: `${siteOrigin}/pricing`, description1: "View our pricing plans", description2: "Find the right plan for you" },
      { text: "Contact Us", url: `${siteOrigin}/contact`, description1: "Get in touch with our team", description2: "We respond within 24h" },
      { text: "Get Started", url: `${siteOrigin}/signup`, description1: "Start your free trial today", description2: "No credit card required" },
    ] : [];

    // 5. Create campaign on platform — pass Smart Bidding targets
    // so Google's AI optimizes towards our goals
    const campaignSpec: CampaignSpec = {
      name: campaign.name,
      objective: mapObjective(campaign.objective),
      dailyBudget: campaign.dailyBudget ?? 10,
      totalBudget: campaign.totalBudget ?? undefined,
      currency: campaign.currency,
      status: "paused", // Always create as paused first for safety
      targetCpa: workspaceConfig?.targetCac ?? undefined,
      targetRoas: workspaceConfig?.targetRoas ?? undefined,
      targetGeos: allLocations.size > 0 ? [...allLocations] : undefined,
      sitelinks: defaultSitelinks,
    };

    const campaignStep: ExecutionStep = {
      entity: "campaign",
      entityId: campaignId,
      status: "pending",
    };
    steps.push(campaignStep);

    const platformCampaign = await adapter.createCampaign(
      adCredentials,
      campaignSpec
    );
    campaignStep.platformId = platformCampaign.platformId;
    campaignStep.status = "success";

    // Store platform campaign ID
    const existingPlatformIds =
      (campaign.platformCampaignIds as Record<string, string>) ?? {};
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        platformCampaignIds: {
          ...existingPlatformIds,
          [platform]: platformCampaign.platformId,
        },
      },
    });

    // 6. Create ad groups
    for (const adGroup of campaign.adGroups) {
      const agStep: ExecutionStep = {
        entity: "adGroup",
        entityId: adGroup.id,
        status: "pending",
      };
      steps.push(agStep);

      try {
        const targeting = (adGroup.targeting as Record<string, unknown>) ?? {};
        const adGroupSpec: AdGroupSpec = {
          name: adGroup.name,
          targeting: {
            keywords: (targeting.keywords as string[]) ?? [],
            locations: (targeting.locations as string[]) ?? [],
            interests: (targeting.interests as string[]) ?? [],
            ageMin: targeting.ageMin as number | undefined,
            ageMax: targeting.ageMax as number | undefined,
            devices: (targeting.devices as string[]) ?? [],
          },
          placements: (adGroup.placements as string[]) ?? undefined,
          dailyBudget: adGroup.dailyBudget ?? undefined,
        };

        const platformAdGroup = await adapter.createAdGroup(
          adCredentials,
          platformCampaign.platformId,
          adGroupSpec
        );
        agStep.platformId = platformAdGroup.platformId;
        agStep.status = "success";

        // Store platform ad group ID
        const existingAgIds =
          (adGroup.platformAdGroupIds as Record<string, string>) ?? {};
        await prisma.adGroup.update({
          where: { id: adGroup.id },
          data: {
            platformAdGroupIds: {
              ...existingAgIds,
              [platform]: platformAdGroup.platformId,
            },
          },
        });

        // 7. Create ads within each ad group
        for (const agCreative of adGroup.creatives) {
          const adStep: ExecutionStep = {
            entity: "ad",
            entityId: agCreative.id,
            status: "pending",
          };
          steps.push(adStep);

          try {
            const content =
              (agCreative.creative.content as Record<string, unknown>) ?? {};
            const agTargeting = (adGroup.targeting as Record<string, unknown>) ?? {};
            const adSpec: AdSpec = {
              name: agCreative.creative.title ?? adGroup.name,
              headline: (content.headline as string) ?? "",
              body: (content.body as string) ?? "",
              callToAction: (content.cta as string) ?? "Learn More",
              destinationUrl: (content.destinationUrl as string) ?? "",
              descriptions: (content.descriptions as string[]) ?? [],
              // RSA quality: pass extra headlines + keywords for Google's 15-headline requirement
              headlines: (content.headlines as string[]) ?? [],
              keywords: (agTargeting.keywords as string[]) ?? [],
            };

            const platformAd = await adapter.createAd(
              adCredentials,
              platformAdGroup.platformId,
              adSpec
            );
            adStep.platformId = platformAd.platformId;
            adStep.status = "success";

            if (platformAd.policyIssues?.length) {
              adStep.error = `Policy issues: ${platformAd.policyIssues.join(", ")}`;
            }
          } catch (err) {
            adStep.status = "failed";
            adStep.error =
              err instanceof Error ? err.message : "Ad creation failed";
          }
        }
      } catch (err) {
        agStep.status = "failed";
        agStep.error =
          err instanceof Error ? err.message : "Ad group creation failed";
      }
    }

    // 8. Update campaign status based on results
    const allAdsSucceeded = steps
      .filter((s) => s.entity === "ad")
      .every((s) => s.status === "success");
    const anyAdSucceeded = steps
      .filter((s) => s.entity === "ad")
      .some((s) => s.status === "success");

    const finalStatus = allAdsSucceeded
      ? "active"
      : anyAdSucceeded
        ? "active" // Partial success — still active
        : "failed";

    // Auto-enable campaign on platform if everything succeeded
    if (finalStatus === "active") {
      try {
        await adapter.resumeCampaign(adCredentials, platformCampaign.platformId);
      } catch (enableErr) {
        console.warn("[executor] Failed to auto-enable campaign:", enableErr);
      }
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: finalStatus },
    });

    // 9. Auto-transition workspace to "monitoring" if a campaign just went live
    //    The autonomous loop (scheduler, agents, sync) only activates for workspaces
    //    in monitoring/optimizing/scaling states.
    if (finalStatus === "active") {
      const PRE_MONITORING_STATES = [
        "onboarding", "auditing", "strategy_ready", "producing",
        "awaiting_approval", "launching",
      ];
      const workspace = await prisma.workspace.findUnique({
        where: { id: campaign.workspaceId },
        select: { status: true },
      });
      if (workspace && PRE_MONITORING_STATES.includes(workspace.status)) {
        await prisma.workspace.update({
          where: { id: campaign.workspaceId },
          data: { status: "monitoring" },
        });
        await prisma.event.create({
          data: {
            workspaceId: campaign.workspaceId,
            type: "workspace_status_changed",
            data: {
              from: workspace.status,
              to: "monitoring",
              trigger: "campaigns_live",
              reason: `Campaign "${campaign.name}" launched successfully on ${platform}`,
            },
          },
        });
        console.log(`[executor] Workspace ${campaign.workspaceId} auto-transitioned to monitoring`);
      }
    }

    // 10. Create an event record
    await prisma.event.create({
      data: {
        workspaceId: campaign.workspaceId,
        type: "campaign_launched",
        data: {
          campaignId,
          platform,
          platformCampaignId: platformCampaign.platformId,
          stepsTotal: steps.length,
          stepsSucceeded: steps.filter((s) => s.status === "success").length,
          stepsFailed: steps.filter((s) => s.status === "failed").length,
        },
      },
    });

    return {
      campaignId,
      platform,
      success: true,
      platformCampaignId: platformCampaign.platformId,
      steps,
    };
  } catch (err) {
    // Extract meaningful error message from gRPC/API errors
    let message = "Execution failed";
    if (err instanceof Error) {
      message = err.message;
    } else if (typeof err === "object" && err !== null) {
      const errObj = err as Record<string, unknown>;
      message = String(
        errObj.message || errObj.details || errObj.code || JSON.stringify(err)
      );
    }
    console.error(`[executor] Campaign ${campaignId} failed on ${platform}:`, err);

    // Top-level failure — mark campaign as failed
    await prisma.campaign
      .update({
        where: { id: campaignId },
        data: { status: "failed" },
      })
      .catch(() => {}); // Don't fail on status update

    return {
      campaignId,
      platform,
      success: false,
      steps,
      error: message,
    };
  }
}

/**
 * Execute a campaign to all appropriate platforms.
 * Determines the target platform from campaign type and connected accounts.
 */
export async function executeCampaignAllPlatforms(
  campaignId: string
): Promise<ExecutionResult[]> {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: {
      workspace: {
        include: {
          connectedAccounts: {
            where: { isActive: true },
            select: { platform: true },
          },
        },
      },
    },
  });

  const connectedPlatforms = campaign.workspace.connectedAccounts.map(
    (a) => a.platform
  );

  // Determine which platform(s) to target
  const defaultPlatform = mapCampaignType(campaign.type);
  const targetPlatforms = connectedPlatforms.includes(defaultPlatform as never)
    ? [defaultPlatform]
    : connectedPlatforms.length > 0
      ? [connectedPlatforms[0]]
      : [];

  if (targetPlatforms.length === 0) {
    return [
      {
        campaignId,
        platform: defaultPlatform,
        success: false,
        steps: [],
        error: "No connected ad platform accounts. Connect Google or Meta first.",
      },
    ];
  }

  const results: ExecutionResult[] = [];
  for (const platform of targetPlatforms) {
    const result = await executeCampaign(campaignId, platform);
    results.push(result);
  }

  return results;
}

/**
 * Launch all approved campaigns in a workspace.
 */
export async function launchWorkspaceCampaigns(
  workspaceId: string
): Promise<ExecutionResult[]> {
  const campaigns = await prisma.campaign.findMany({
    where: {
      workspaceId,
      status: "approved",
    },
    select: { id: true },
  });

  const results: ExecutionResult[] = [];
  for (const campaign of campaigns) {
    const campaignResults = await executeCampaignAllPlatforms(campaign.id);
    results.push(...campaignResults);
  }

  return results;
}
