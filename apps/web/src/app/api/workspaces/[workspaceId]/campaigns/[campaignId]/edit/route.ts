/**
 * Campaign Edit API
 *
 * POST — Send a natural-language prompt to evolve/modify a campaign.
 * Claude receives the full current campaign structure and the edit request,
 * returns an updated structure, and we apply the diff to the DB.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kalit/db";
import { llmComplete, parseJSON } from "@/lib/llm/client";
import { getAdapter, type AdCredentials, type AdGroupSpec, type AdSpec } from "@/lib/adapters";
import { getValidCredentials } from "@/lib/oauth/refresh";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ workspaceId: string; campaignId: string }>;
}

interface EditedCampaign {
  name: string;
  objective: string;
  targetAudience: string;
  messagingAngle: string;
  hypothesis: string;
  dailyBudget: number;
  totalBudget: number;
  adGroups: Array<{
    id?: string; // existing ad group ID (omit for new ones)
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
      id?: string; // existing creative ID (omit for new ones)
      headline: string;
      headlines?: string[];
      body: string;
      cta: string;
      destinationUrl: string;
      descriptions?: string[];
      messagingAngle?: string;
      tags?: string[];
    }>;
  }>;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { workspaceId, campaignId } = await ctx.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const body = await req.json();
  const prompt = body.prompt as string;

  if (!prompt || !prompt.trim()) {
    return NextResponse.json(
      { error: "prompt is required" },
      { status: 400 }
    );
  }

  // 1. Load full campaign structure
  const campaign = await prisma.campaign.findUnique({
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
                  tags: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!campaign || campaign.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // 2. Serialize current campaign for Claude
  const currentStructure = {
    name: campaign.name,
    type: campaign.type,
    objective: campaign.objective,
    targetAudience: campaign.targetAudience,
    messagingAngle: campaign.messagingAngle,
    hypothesis: campaign.hypothesis,
    dailyBudget: campaign.dailyBudget,
    totalBudget: campaign.totalBudget,
    adGroups: campaign.adGroups.map((ag) => ({
      id: ag.id,
      name: ag.name,
      targeting: ag.targeting,
      placements: ag.placements,
      ads: ag.creatives.map((agc) => {
        const content = agc.creative.content as Record<string, unknown>;
        return {
          id: agc.creative.id,
          headline: content.headline ?? agc.creative.title ?? "",
          body: content.body ?? "",
          cta: content.cta ?? "",
          destinationUrl: content.destinationUrl ?? "",
          descriptions: content.descriptions ?? [],
          messagingAngle: agc.creative.messagingAngle,
          tags: agc.creative.tags,
        };
      }),
    })),
  };

  // 3. Ask Claude to edit the campaign
  const systemPrompt = `You are a senior growth marketer and campaign architect. You will receive a current campaign structure and an edit request from the user. Your job is to apply the requested changes and return the COMPLETE updated campaign structure as JSON.

Rules:
- Return the FULL campaign structure (not just the changed parts) so we can do a complete update.
- Keep existing ad group IDs and creative IDs when they are not being replaced (include "id" field).
- For NEW ad groups or ads you create, omit the "id" field.
- If the user asks to remove something, simply exclude it from the output.
- Maintain the same JSON schema as the input.
- Be creative with copy — write compelling headlines, body text, and CTAs.
- Keep budgets reasonable unless the user explicitly asks to change them.
- Return ONLY valid JSON, no markdown fences, no explanation.

JSON schema for your response:
{
  "name": "string",
  "objective": "string (awareness|traffic|engagement|leads|conversions|sales)",
  "targetAudience": "string",
  "messagingAngle": "string",
  "hypothesis": "string",
  "dailyBudget": number,
  "totalBudget": number,
  "adGroups": [{
    "id": "string (optional, include for existing ad groups)",
    "name": "string",
    "targeting": {
      "keywords": ["string"],
      "ageMin": number,
      "ageMax": number,
      "locations": ["string"],
      "interests": ["string"],
      "devices": ["string"]
    },
    "placements": ["string"],
    "ads": [{
      "id": "string (optional, include for existing ads)",
      "headline": "string (max 30 chars for Google Ads RSA)",
      "headlines": ["string (max 30 chars each) — include 5+ for RSA rotation"],
      "body": "string (max 90 chars)",
      "cta": "string",
      "destinationUrl": "string",
      "descriptions": ["string (max 90 chars each) — include 3+"],
      "messagingAngle": "string",
      "tags": ["string"]
    }]
  }]
}`;

  const userPrompt = `Here is the current campaign:

${JSON.stringify(currentStructure, null, 2)}

---

User's edit request: ${prompt}

Return the COMPLETE updated campaign structure as JSON.`;

  try {
    const response = await llmComplete({
      model: "claude-sonnet-4-6",
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 8192,
    });

    const edited = parseJSON<EditedCampaign>(response.text);

    // 4. Apply changes to DB
    // Update campaign fields
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        name: edited.name,
        objective: edited.objective,
        targetAudience: edited.targetAudience,
        messagingAngle: edited.messagingAngle,
        hypothesis: edited.hypothesis,
        dailyBudget: edited.dailyBudget,
        totalBudget: edited.totalBudget,
      },
    });

    // Track which existing ad group IDs are kept
    const existingAgIds = campaign.adGroups.map((ag) => ag.id);
    const keptAgIds = new Set<string>();

    for (const agData of edited.adGroups) {
      if (agData.id && existingAgIds.includes(agData.id)) {
        // Update existing ad group
        keptAgIds.add(agData.id);
        await prisma.adGroup.update({
          where: { id: agData.id },
          data: {
            name: agData.name,
            targeting: agData.targeting as object,
            placements: agData.placements ?? [],
          },
        });

        // Handle ads within this ad group
        const existingAg = campaign.adGroups.find((a) => a.id === agData.id)!;
        const existingCreativeIds = existingAg.creatives.map(
          (c) => c.creative.id
        );
        const keptCreativeIds = new Set<string>();

        for (const adData of agData.ads) {
          if (adData.id && existingCreativeIds.includes(adData.id)) {
            // Update existing creative
            keptCreativeIds.add(adData.id);
            await prisma.creative.update({
              where: { id: adData.id },
              data: {
                title: adData.headline,
                content: {
                  headline: adData.headline,
                  headlines: adData.headlines ?? [],
                  body: adData.body,
                  cta: adData.cta,
                  destinationUrl: adData.destinationUrl,
                  descriptions: adData.descriptions ?? [],
                },
                messagingAngle: adData.messagingAngle ?? null,
                tags: adData.tags ?? [],
              },
            });
          } else {
            // Create new creative + link
            const creative = await prisma.creative.create({
              data: {
                workspaceId,
                type: "ad_copy",
                status: "draft",
                version: 1,
                title: adData.headline,
                content: {
                  headline: adData.headline,
                  headlines: adData.headlines ?? [],
                  body: adData.body,
                  cta: adData.cta,
                  destinationUrl: adData.destinationUrl,
                  descriptions: adData.descriptions ?? [],
                },
                messagingAngle: adData.messagingAngle ?? null,
                tags: adData.tags ?? [],
              },
            });
            await prisma.adGroupCreative.create({
              data: {
                adGroupId: agData.id,
                creativeId: creative.id,
                isActive: true,
              },
            });
          }
        }

        // Remove creatives that were dropped
        for (const cId of existingCreativeIds) {
          if (!keptCreativeIds.has(cId)) {
            // Remove the junction record (keep creative for history)
            const junction = existingAg.creatives.find(
              (c) => c.creative.id === cId
            );
            if (junction) {
              await prisma.adGroupCreative.delete({
                where: { id: junction.id },
              });
            }
          }
        }
      } else {
        // Create new ad group
        const newAg = await prisma.adGroup.create({
          data: {
            campaignId,
            name: agData.name,
            targeting: agData.targeting as object,
            placements: agData.placements ?? [],
          },
        });

        // Create ads for new ad group
        for (const adData of agData.ads) {
          const creative = await prisma.creative.create({
            data: {
              workspaceId,
              type: "ad_copy",
              status: "draft",
              version: 1,
              title: adData.headline,
              content: {
                headline: adData.headline,
                body: adData.body,
                cta: adData.cta,
                destinationUrl: adData.destinationUrl,
                descriptions: adData.descriptions ?? [],
              },
              messagingAngle: adData.messagingAngle ?? null,
              tags: adData.tags ?? [],
            },
          });
          await prisma.adGroupCreative.create({
            data: {
              adGroupId: newAg.id,
              creativeId: creative.id,
              isActive: true,
            },
          });
        }
      }
    }

    // Remove ad groups that were dropped
    for (const agId of existingAgIds) {
      if (!keptAgIds.has(agId)) {
        // Delete junction records first, then ad group
        await prisma.adGroupCreative.deleteMany({
          where: { adGroupId: agId },
        });
        await prisma.adGroup.delete({ where: { id: agId } });
      }
    }

    // 5. Sync to platform if campaign is live
    const platformSyncResults: string[] = [];
    const updatedCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true, platformCampaignIds: true, dailyBudget: true },
    });

    const isLive = ["active", "paused", "optimizing", "scaling"].includes(
      updatedCampaign?.status ?? ""
    );
    const platformIds = (updatedCampaign?.platformCampaignIds as Record<string, string>) ?? {};

    if (isLive && Object.keys(platformIds).length > 0) {
      for (const [platform, platformCampaignId] of Object.entries(platformIds)) {
        try {
          const adapter = getAdapter(platform);
          if (!adapter) continue;

          const account = await prisma.connectedAccount.findFirst({
            where: { workspaceId, platform: platform as never, isActive: true },
          });
          if (!account) continue;

          const creds = await getValidCredentials(account.id);
          const adCredentials: AdCredentials = {
            accessToken: creds.accessToken,
            refreshToken: creds.refreshToken,
            accountId: account.accountId,
            metadata: (account.metadata as Record<string, string>) ?? {},
          };

          // Sync budget change
          if (edited.dailyBudget !== campaign.dailyBudget) {
            await adapter.updateBudget(adCredentials, platformCampaignId, edited.dailyBudget);
            platformSyncResults.push(`${platform}: budget updated to $${edited.dailyBudget}/day`);
          }

          // Create new ad groups + ads on platform
          const freshCampaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
              adGroups: {
                include: {
                  creatives: {
                    include: {
                      creative: {
                        select: { id: true, title: true, content: true },
                      },
                    },
                  },
                },
              },
            },
          });

          if (freshCampaign) {
            for (const ag of freshCampaign.adGroups) {
              const agPlatformIds = (ag.platformAdGroupIds as Record<string, string>) ?? {};

              if (!agPlatformIds[platform]) {
                // New ad group — create on platform
                const targeting = (ag.targeting as Record<string, unknown>) ?? {};
                const adGroupSpec: AdGroupSpec = {
                  name: ag.name,
                  targeting: {
                    keywords: (targeting.keywords as string[]) ?? [],
                    locations: (targeting.locations as string[]) ?? [],
                    interests: (targeting.interests as string[]) ?? [],
                    ageMin: targeting.ageMin as number | undefined,
                    ageMax: targeting.ageMax as number | undefined,
                    devices: (targeting.devices as string[]) ?? [],
                  },
                  placements: (ag.placements as string[]) ?? undefined,
                  dailyBudget: ag.dailyBudget ?? undefined,
                };

                const platformAg = await adapter.createAdGroup(
                  adCredentials,
                  platformCampaignId,
                  adGroupSpec
                );

                await prisma.adGroup.update({
                  where: { id: ag.id },
                  data: {
                    platformAdGroupIds: {
                      ...agPlatformIds,
                      [platform]: platformAg.platformId,
                    },
                  },
                });

                // Create all ads in this new ad group
                for (const agc of ag.creatives) {
                  const content = (agc.creative.content as Record<string, unknown>) ?? {};
                  const adSpec: AdSpec = {
                    name: agc.creative.title ?? ag.name,
                    headline: (content.headline as string) ?? "",
                    body: (content.body as string) ?? "",
                    callToAction: (content.cta as string) ?? "Learn More",
                    destinationUrl: (content.destinationUrl as string) ?? "",
                    descriptions: (content.descriptions as string[]) ?? [],
                    headlines: (content.headlines as string[]) ?? [],
                    keywords: (targeting.keywords as string[]) ?? [],
                  };

                  await adapter.createAd(adCredentials, platformAg.platformId, adSpec);
                }

                platformSyncResults.push(
                  `${platform}: created ad group "${ag.name}" with ${ag.creatives.length} ads`
                );
              }
            }
          }
        } catch (syncErr) {
          platformSyncResults.push(
            `${platform}: sync error — ${syncErr instanceof Error ? syncErr.message : "unknown"}`
          );
        }
      }
    }

    // 6. Create event
    await prisma.event.create({
      data: {
        workspaceId,
        type: "agent_action_taken",
        data: {
          action: "campaign_edited",
          campaignId,
          prompt,
          changes: {
            name: edited.name,
            adGroups: edited.adGroups.length,
            totalAds: edited.adGroups.reduce(
              (s, ag) => s + ag.ads.length,
              0
            ),
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaignId,
        name: edited.name,
        adGroups: edited.adGroups.length,
        totalAds: edited.adGroups.reduce((s, ag) => s + ag.ads.length, 0),
      },
      platformSync: platformSyncResults.length > 0 ? platformSyncResults : undefined,
    });
  } catch (err) {
    console.error("[campaign-edit] Error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Edit failed",
      },
      { status: 500 }
    );
  }
}
