/**
 * Creative Fatigue Detector
 *
 * Monitors CTR/engagement trends and flags creatives that are losing effectiveness.
 * Triggers rotation when fatigue is detected.
 */

import { prisma } from "@kalit/db";

interface FatigueReport {
  workspaceId: string;
  analyzed: number;
  fatigued: FatiguedCreative[];
  healthy: number;
}

interface FatiguedCreative {
  creativeId: string;
  campaignId: string;
  campaignName: string;
  name: string;
  impressions: number;
  currentCtr: number;
  peakCtr: number;
  ctrDecline: number;
  daysSinceLaunch: number;
  severity: "low" | "medium" | "high";
  recommendation: string;
}

const CTR_DECLINE_LOW = 0.15; // 15% decline
const CTR_DECLINE_MEDIUM = 0.30; // 30% decline
const CTR_DECLINE_HIGH = 0.50; // 50% decline
const MIN_IMPRESSIONS = 1000; // need enough data
const FREQUENCY_CAP_WARN = 4; // frequency > 4 = fatigue risk

/**
 * Scan all active creatives for fatigue signals.
 */
export async function detectFatigue(
  workspaceId: string
): Promise<FatigueReport> {
  const campaigns = await prisma.campaign.findMany({
    where: {
      workspaceId,
      status: { in: ["active", "optimizing"] },
    },
    include: {
      adGroups: {
        include: {
          creatives: {
            include: {
              creative: true,
            },
          },
        },
      },
    },
  });

  const fatigued: FatiguedCreative[] = [];
  let analyzed = 0;

  for (const campaign of campaigns) {
    for (const adGroup of campaign.adGroups) {
      for (const agCreative of adGroup.creatives) {
        const creative = agCreative.creative;
        if (creative.status !== "active") continue;

        analyzed++;
        const impressions = agCreative.impressions;

        if (impressions < MIN_IMPRESSIONS) continue;

        const currentCtr =
          impressions > 0 ? agCreative.clicks / impressions : 0;
        // Estimate peak CTR from creative's overall stats vs ad group stats
        const creativeTotalCtr =
          creative.impressions > 0
            ? creative.clicks / creative.impressions
            : currentCtr;
        const peakCtr = Math.max(creativeTotalCtr, currentCtr);

        if (peakCtr <= 0) continue;

        const ctrDecline = 1 - currentCtr / peakCtr;
        const daysSinceLaunch = Math.floor(
          (Date.now() - creative.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (ctrDecline >= CTR_DECLINE_LOW) {
          let severity: "low" | "medium" | "high" = "low";
          let recommendation = "Monitor closely — early fatigue signal";

          if (ctrDecline >= CTR_DECLINE_HIGH) {
            severity = "high";
            recommendation =
              "Immediate rotation needed — creative severely fatigued";
          } else if (ctrDecline >= CTR_DECLINE_MEDIUM) {
            severity = "medium";
            recommendation =
              "Schedule rotation — prepare replacement creative";
          }

          fatigued.push({
            creativeId: creative.id,
            campaignId: campaign.id,
            campaignName: campaign.name,
            name: creative.title ?? creative.id,
            impressions,
            currentCtr,
            peakCtr,
            ctrDecline,
            daysSinceLaunch,
            severity,
            recommendation,
          });
        }
      }
    }
  }

  // Sort by severity (high first) then decline
  fatigued.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return b.ctrDecline - a.ctrDecline;
  });

  return {
    workspaceId,
    analyzed,
    fatigued,
    healthy: analyzed - fatigued.length,
  };
}

/**
 * Mark fatigued creatives and log events.
 */
export async function rotateFatiguedCreatives(
  workspaceId: string,
  creativeIds: string[]
): Promise<number> {
  let rotated = 0;

  for (const id of creativeIds) {
    await prisma.creative.update({
      where: { id },
      data: { status: "fatigued" },
    });

    await prisma.event.create({
      data: {
        workspaceId,
        type: "creative_rotated",
        data: {
          oldCreativeId: id,
          action: "paused_due_to_fatigue",
          reason: "CTR decline detected — creative fatigued",
        },
      },
    });

    rotated++;
  }

  return rotated;
}
