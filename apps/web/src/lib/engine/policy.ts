/**
 * Policy Engine
 *
 * Evaluates workspace policy rules to determine if an action
 * should be allowed, require approval, be blocked, or trigger an alert.
 */

import { prisma } from "@kalit/db";

export type PolicyAction = "allow" | "require_approval" | "block" | "alert";

interface PolicyCondition {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "in" | "not_in";
  value: string | number | boolean | string[];
}

interface EvaluationContext {
  [key: string]: unknown;
}

/**
 * Evaluate all active policy rules for a workspace against a context.
 * Returns the most restrictive action that matches.
 */
export async function evaluatePolicy(
  workspaceId: string,
  context: EvaluationContext
): Promise<{
  action: PolicyAction;
  matchedRules: { name: string; action: PolicyAction }[];
}> {
  const rules = await prisma.policyRule.findMany({
    where: { workspaceId, isActive: true },
    orderBy: { priority: "desc" },
  });

  const matchedRules: { name: string; action: PolicyAction }[] = [];

  for (const rule of rules) {
    const condition = rule.condition as unknown as PolicyCondition;
    if (evaluateCondition(condition, context)) {
      matchedRules.push({
        name: rule.name,
        action: rule.action as PolicyAction,
      });
    }
  }

  // Determine the most restrictive action
  // Priority: block > require_approval > alert > allow
  const actionPriority: Record<PolicyAction, number> = {
    block: 3,
    require_approval: 2,
    alert: 1,
    allow: 0,
  };

  let resultAction: PolicyAction = "allow";
  for (const matched of matchedRules) {
    if (actionPriority[matched.action] > actionPriority[resultAction]) {
      resultAction = matched.action;
    }
  }

  return { action: resultAction, matchedRules };
}

function evaluateCondition(
  condition: PolicyCondition,
  context: EvaluationContext
): boolean {
  const fieldValue = context[condition.field];
  const targetValue = condition.value;

  switch (condition.operator) {
    case "eq":
      return fieldValue === targetValue;
    case "neq":
      return fieldValue !== targetValue;
    case "gt":
      return typeof fieldValue === "number" && fieldValue > (targetValue as number);
    case "gte":
      return typeof fieldValue === "number" && fieldValue >= (targetValue as number);
    case "lt":
      return typeof fieldValue === "number" && fieldValue < (targetValue as number);
    case "lte":
      return typeof fieldValue === "number" && fieldValue <= (targetValue as number);
    case "contains":
      return typeof fieldValue === "string" && fieldValue.includes(targetValue as string);
    case "in":
      return Array.isArray(targetValue) && targetValue.includes(fieldValue as string);
    case "not_in":
      return Array.isArray(targetValue) && !targetValue.includes(fieldValue as string);
    default:
      return false;
  }
}

/**
 * Check if a specific action should proceed, require approval, or be blocked.
 * Uses both workspace-level policy rules and autonomy mode.
 */
export async function checkActionPolicy(
  workspaceId: string,
  actionType: string,
  actionContext: EvaluationContext
): Promise<{
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
}> {
  // Get workspace autonomy mode
  const config = await prisma.workspaceConfig.findUnique({
    where: { workspaceId },
  });

  if (!config) {
    return { allowed: false, requiresApproval: false, reason: "Workspace not configured" };
  }

  // Draft mode — nothing executes
  if (config.autonomyMode === "draft") {
    return { allowed: false, requiresApproval: true, reason: "Workspace in draft mode" };
  }

  // Evaluate policy rules
  const policyResult = await evaluatePolicy(workspaceId, {
    ...actionContext,
    actionType,
  });

  if (policyResult.action === "block") {
    const blockRule = policyResult.matchedRules.find((r) => r.action === "block");
    return {
      allowed: false,
      requiresApproval: false,
      reason: `Blocked by policy: ${blockRule?.name}`,
    };
  }

  // Approval mode — everything needs approval
  if (config.autonomyMode === "approval") {
    return { allowed: true, requiresApproval: true, reason: "Workspace requires approval for all actions" };
  }

  // Guardrailed — check if policy requires approval
  if (config.autonomyMode === "guardrailed") {
    if (policyResult.action === "require_approval") {
      const approvalRule = policyResult.matchedRules.find((r) => r.action === "require_approval");
      return {
        allowed: true,
        requiresApproval: true,
        reason: `Approval required by policy: ${approvalRule?.name}`,
      };
    }
    return { allowed: true, requiresApproval: false };
  }

  // Full autonomous — proceed unless blocked
  return { allowed: true, requiresApproval: false };
}
