/**
 * Budget Optimizer
 *
 * Reallocates budget across campaigns based on ROAS/CPA performance.
 * Gated by measurement confidence — won't scale until confidence ≥ 0.6.
 */

import { prisma } from "@kalit/db";
import { computeMeasurementConfidence } from "../tracking/measurement";

interface ReallocationResult {
  workspaceId: string;
  gated: boolean;
  gateReason?: string;
  confidence: number;
  reallocations: Reallocation[];
  totalBudget: number;
}

interface Reallocation {
  campaignId: string;
  campaignName: string;
  previousBudget: number;
  newBudget: number;
  change: number;
  reason: string;
}

const MIN_CONFIDENCE = 0.6;
const MIN_DAILY_BUDGET = 5; // never go below $5/day
const MAX_INCREASE_PCT = 0.5; // max 50% increase per cycle
const MAX_DECREASE_PCT = 0.3; // max 30% decrease per cycle
const ROAS_SCALE_THRESHOLD = 2.0; // scale campaigns with ROAS ≥ 2x
const ROAS_CUT_THRESHOLD = 0.5; // cut campaigns with ROAS < 0.5x
const CPA_PENALTY_MULTIPLIER = 1.5; // penalize campaigns with CPA > 1.5x avg

/**
 * Analyze campaigns and propose budget reallocations.
 */
export async function optimizeBudget(
  workspaceId: string
): Promise<ReallocationResult> {
  const { overall: confidence } =
    await computeMeasurementConfidence(workspaceId);

  if (confidence < MIN_CONFIDENCE) {
    return {
      workspaceId,
      gated: true,
      gateReason: `Measurement confidence ${(confidence * 100).toFixed(0)}% is below ${MIN_CONFIDENCE * 100}% threshold. Collect more data before optimizing.`,
      confidence,
      reallocations: [],
      totalBudget: 0,
    };
  }

  const campaigns = await prisma.campaign.findMany({
    where: {
      workspaceId,
      status: { in: ["active", "optimizing"] },
    },
    orderBy: { roas: "desc" },
  });

  if (campaigns.length < 2) {
    return {
      workspaceId,
      gated: true,
      gateReason: "Need at least 2 active campaigns to optimize budget allocation.",
      confidence,
      reallocations: [],
      totalBudget: campaigns.reduce((s, c) => s + (c.dailyBudget ?? 0), 0),
    };
  }

  const totalBudget = campaigns.reduce((s, c) => s + (c.dailyBudget ?? 0), 0);
  const avgCpa =
    campaigns.reduce((s, c) => s + (c.cpa ?? 0), 0) / campaigns.length;

  const reallocations: Reallocation[] = [];
  let budgetPool = 0; // freed budget from cuts

  // Phase 1: Identify cuts (underperformers)
  for (const c of campaigns) {
    const roas = c.roas ?? 0;
    const cpa = c.cpa ?? Infinity;

    if (roas < ROAS_CUT_THRESHOLD && c.spend > 50) {
      const decrease = Math.min(
        (c.dailyBudget ?? 0) * MAX_DECREASE_PCT,
        (c.dailyBudget ?? 0) - MIN_DAILY_BUDGET
      );
      if (decrease > 0) {
        budgetPool += decrease;
        reallocations.push({
          campaignId: c.id,
          campaignName: c.name,
          previousBudget: (c.dailyBudget ?? 0),
          newBudget: (c.dailyBudget ?? 0) - decrease,
          change: -decrease,
          reason: `Low ROAS (${roas.toFixed(2)}x) — reducing budget`,
        });
      }
    } else if (cpa > avgCpa * CPA_PENALTY_MULTIPLIER && c.spend > 50) {
      const decrease = Math.min(
        (c.dailyBudget ?? 0) * (MAX_DECREASE_PCT * 0.5),
        (c.dailyBudget ?? 0) - MIN_DAILY_BUDGET
      );
      if (decrease > 0) {
        budgetPool += decrease;
        reallocations.push({
          campaignId: c.id,
          campaignName: c.name,
          previousBudget: (c.dailyBudget ?? 0),
          newBudget: (c.dailyBudget ?? 0) - decrease,
          change: -decrease,
          reason: `High CPA ($${cpa.toFixed(0)} vs avg $${avgCpa.toFixed(0)}) — reducing budget`,
        });
      }
    }
  }

  // Phase 2: Distribute freed budget to top performers
  const winners = campaigns.filter(
    (c) =>
      (c.roas ?? 0) >= ROAS_SCALE_THRESHOLD &&
      !reallocations.find((r) => r.campaignId === c.id)
  );

  if (winners.length > 0 && budgetPool > 0) {
    const perWinner = budgetPool / winners.length;
    for (const w of winners) {
      const maxIncrease = (w.dailyBudget ?? 0) * MAX_INCREASE_PCT;
      const increase = Math.min(perWinner, maxIncrease);
      reallocations.push({
        campaignId: w.id,
        campaignName: w.name,
        previousBudget: (w.dailyBudget ?? 0),
        newBudget: (w.dailyBudget ?? 0) + increase,
        change: increase,
        reason: `Strong ROAS (${(w.roas ?? 0).toFixed(2)}x) — scaling budget`,
      });
    }
  }

  return {
    workspaceId,
    gated: false,
    confidence,
    reallocations,
    totalBudget,
  };
}

/**
 * Apply budget reallocations — updates campaigns and logs events.
 */
export async function applyReallocations(
  workspaceId: string,
  reallocations: Reallocation[]
): Promise<void> {
  for (const r of reallocations) {
    await prisma.campaign.update({
      where: { id: r.campaignId },
      data: { dailyBudget: r.newBudget },
    });

    await prisma.event.create({
      data: {
        workspaceId,
        type: "budget_reallocated",
        data: {
          campaignId: r.campaignId,
          campaignName: r.campaignName,
          from: r.previousBudget,
          to: r.newBudget,
          amount: Math.abs(r.change),
          reason: r.reason,
        },
      },
    });
  }
}
