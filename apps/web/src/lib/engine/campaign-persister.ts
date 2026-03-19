/**
 * Campaign Persister
 *
 * Takes structured campaign output from Claude (campaign architect agent)
 * and persists Campaign, AdGroup, Creative, and AdGroupCreative records.
 */

import { prisma } from "@kalit/db";

export interface CampaignArchitectOutput {
  campaigns: Array<{
    name: string;
    type: string; // paid_search, paid_social, display, etc.
    objective: string; // awareness, traffic, conversions, sales, leads
    targetAudience: string;
    messagingAngle: string;
    hypothesis: string;
    dailyBudget: number;
    totalBudget: number;
    adGroups: Array<{
      name: string;
      targeting: {
        keywords?: string[];
        ageMin?: number;
        ageMax?: number;
        locations?: string[];
        interests?: string[];
        devices?: string[];
      };
      placements?: string[];
      ads: Array<{
        headline: string;
        body: string;
        cta: string;
        destinationUrl: string;
        descriptions?: string[];
        messagingAngle?: string;
        tags?: string[];
      }>;
    }>;
  }>;
}

export interface PersistedCampaign {
  campaignId: string;
  campaignName: string;
  adGroupIds: string[];
  creativeIds: string[];
}

/**
 * Persist campaign architect output to the database.
 * Creates Campaign → AdGroup → Creative → AdGroupCreative records.
 */
export async function persistCampaigns(
  workspaceId: string,
  output: CampaignArchitectOutput,
  currency: string = "USD"
): Promise<PersistedCampaign[]> {
  const results: PersistedCampaign[] = [];

  for (const campaignSpec of output.campaigns) {
    // Create Campaign record
    const campaign = await prisma.campaign.create({
      data: {
        workspaceId,
        name: campaignSpec.name,
        type: (campaignSpec.type || "paid_search") as never,
        status: "draft",
        objective: campaignSpec.objective,
        targetAudience: campaignSpec.targetAudience,
        messagingAngle: campaignSpec.messagingAngle,
        hypothesis: campaignSpec.hypothesis,
        dailyBudget: campaignSpec.dailyBudget,
        totalBudget: campaignSpec.totalBudget,
        currency,
      },
    });

    const adGroupIds: string[] = [];
    const creativeIds: string[] = [];

    for (const agSpec of campaignSpec.adGroups) {
      // Create AdGroup record
      const adGroup = await prisma.adGroup.create({
        data: {
          campaignId: campaign.id,
          name: agSpec.name,
          targeting: agSpec.targeting || {},
          placements: agSpec.placements || [],
        },
      });
      adGroupIds.push(adGroup.id);

      // Create Creative + AdGroupCreative for each ad
      for (const adSpec of agSpec.ads) {
        const creative = await prisma.creative.create({
          data: {
            workspaceId,
            type: "ad_copy" as never,
            status: "draft",
            version: 1,
            title: adSpec.headline,
            content: {
              headline: adSpec.headline,
              body: adSpec.body,
              cta: adSpec.cta,
              destinationUrl: adSpec.destinationUrl,
              descriptions: adSpec.descriptions || [],
            },
            mediaUrls: [],
            hypothesis: campaignSpec.hypothesis,
            targetSegment: campaignSpec.targetAudience,
            messagingAngle: adSpec.messagingAngle || campaignSpec.messagingAngle,
            tags: adSpec.tags || [],
          },
        });
        creativeIds.push(creative.id);

        // Link creative to ad group
        await prisma.adGroupCreative.create({
          data: {
            adGroupId: adGroup.id,
            creativeId: creative.id,
            isActive: true,
          },
        });
      }
    }

    results.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      adGroupIds,
      creativeIds,
    });
  }

  return results;
}
