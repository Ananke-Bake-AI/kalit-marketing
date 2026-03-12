/**
 * Experiment Manager
 *
 * A/B test registry with statistical significance calculation.
 * Manages experiment lifecycle: planned → running → completed.
 */

import { prisma } from "@kalit/db";

interface ExperimentResult {
  experimentId: string;
  status: "running" | "completed" | "insufficient_data";
  confidence: number;
  winner: string | null;
  recommendation: string;
}

/**
 * Create a new experiment.
 */
export async function createExperiment(
  workspaceId: string,
  params: {
    name: string;
    hypothesis: string;
    successMetric: string;
    testDesign?: Record<string, unknown>;
    targetConfidence?: number;
    campaignIds?: string[];
  }
) {
  return prisma.experiment.create({
    data: {
      workspaceId,
      name: params.name,
      hypothesis: params.hypothesis,
      status: "running",
      successMetric: params.successMetric,
      testDesign: params.testDesign as never,
      targetConfidence: params.targetConfidence ?? 0.95,
      startedAt: new Date(),
      ...(params.campaignIds?.length
        ? { campaigns: { connect: params.campaignIds.map((id) => ({ id })) } }
        : {}),
    },
  });
}

/**
 * Evaluate an experiment's current results using its linked campaigns.
 */
export async function evaluateExperiment(
  experimentId: string
): Promise<ExperimentResult> {
  const experiment = await prisma.experiment.findUniqueOrThrow({
    where: { id: experimentId },
    include: { campaigns: true },
  });

  if (experiment.campaigns.length < 2) {
    return {
      experimentId,
      status: "insufficient_data",
      confidence: 0,
      winner: null,
      recommendation:
        "Need at least 2 linked campaigns (control + variant) to evaluate.",
    };
  }

  const [control, variant] = experiment.campaigns;

  const minImpressions = 100;
  if (
    control.impressions < minImpressions ||
    variant.impressions < minImpressions
  ) {
    return {
      experimentId,
      status: "insufficient_data",
      confidence: 0,
      winner: null,
      recommendation: `Need at least ${minImpressions} impressions per variant. Control: ${control.impressions}, Variant: ${variant.impressions}.`,
    };
  }

  // Z-test on conversion rates
  const confidence = calculateConfidence(
    control.conversions,
    control.clicks || 1,
    variant.conversions,
    variant.clicks || 1
  );

  let winner: string | null = null;
  let recommendation = "Continue running — not yet statistically significant.";

  if (confidence >= experiment.targetConfidence) {
    const controlCR =
      control.clicks > 0 ? control.conversions / control.clicks : 0;
    const variantCR =
      variant.clicks > 0 ? variant.conversions / variant.clicks : 0;

    if (variantCR > controlCR) {
      winner = variant.name;
      const uplift = controlCR > 0 ? ((variantCR - controlCR) / controlCR) * 100 : 0;
      recommendation = `Variant "${variant.name}" wins with ${uplift.toFixed(1)}% uplift at ${(confidence * 100).toFixed(1)}% confidence.`;
    } else {
      winner = control.name;
      recommendation = `Control "${control.name}" wins. Variant showed no improvement.`;
    }
  }

  // Check duration
  if (experiment.startedAt) {
    const daysRunning = Math.floor(
      (Date.now() - experiment.startedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysRunning >= 14 && !winner) {
      recommendation = `Running for ${daysRunning} days without significance. Consider increasing sample or redesigning.`;
    }
  }

  return {
    experimentId,
    status: winner ? "completed" : "running",
    confidence,
    winner,
    recommendation,
  };
}

/**
 * Complete an experiment — record winner and update status.
 */
export async function completeExperiment(
  experimentId: string,
  winner: string,
  confidence: number,
  learnings?: string
): Promise<void> {
  await prisma.experiment.update({
    where: { id: experimentId },
    data: {
      status: "completed",
      winnerVariant: winner,
      confidence,
      learnings,
      completedAt: new Date(),
    },
  });
}

/**
 * List experiments for a workspace.
 */
export async function listExperiments(workspaceId: string) {
  return prisma.experiment.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: { campaigns: { select: { id: true, name: true, status: true } } },
  });
}

// --- Helpers ---

/**
 * Two-proportion z-test for conversion rate significance.
 * Returns confidence level (0-1).
 */
function calculateConfidence(
  conversionsA: number,
  trialsA: number,
  conversionsB: number,
  trialsB: number
): number {
  const pA = conversionsA / trialsA;
  const pB = conversionsB / trialsB;
  const pPooled = (conversionsA + conversionsB) / (trialsA + trialsB);

  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / trialsA + 1 / trialsB));

  if (se === 0) return 0;

  const z = Math.abs(pA - pB) / se;

  // Approximate normal CDF using Abramowitz and Stegun
  const t = 1 / (1 + 0.2316419 * z);
  const d = 0.3989422804014327;
  const p =
    d *
    Math.exp((-z * z) / 2) *
    (0.3193815 * t -
      0.3565638 * t * t +
      1.781478 * t * t * t -
      1.8212560 * t * t * t * t +
      1.3302744 * t * t * t * t * t);

  return 1 - 2 * p;
}
