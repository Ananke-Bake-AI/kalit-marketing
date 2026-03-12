/**
 * Task Pipeline State Machine
 *
 * Defines the lifecycle of a growth task through the system.
 * Tasks flow through states based on their job family and outcome.
 */

export const TaskStates = {
  queued: "queued",
  researching: "researching",
  generating: "generating",
  waiting_approval: "waiting_approval",
  approved: "approved",
  executing: "executing",
  published: "published",
  monitoring: "monitoring",
  needs_revision: "needs_revision",
  completed: "completed",
  failed: "failed",
  archived: "archived",
} as const;

export type TaskState = (typeof TaskStates)[keyof typeof TaskStates];

export const JobFamilies = {
  research: "research",
  production: "production",
  execution: "execution",
  review: "review",
} as const;

export type JobFamily = (typeof JobFamilies)[keyof typeof JobFamilies];

/**
 * Valid state transitions per job family.
 * Different job families follow different paths through the pipeline.
 */
export const taskFlows: Record<JobFamily, TaskState[]> = {
  research: [
    "queued",
    "researching",
    "completed", // research doesn't need approval
  ],
  production: [
    "queued",
    "generating",
    "waiting_approval",
    "approved",
    "completed",
  ],
  execution: [
    "queued",
    "executing",
    "published",
    "monitoring",
    "completed",
  ],
  review: [
    "queued",
    "researching", // review starts with analysis
    "completed",
  ],
};

/**
 * Agent type mapping — which specialist handles which job
 */
export const agentTypes = {
  // Research agents
  competitor_analyst: "competitor_analyst",
  seo_researcher: "seo_researcher",
  trend_scanner: "trend_scanner",
  audience_researcher: "audience_researcher",
  market_analyst: "market_analyst",

  // Production agents
  creative_writer: "creative_writer",
  content_strategist: "content_strategist",
  campaign_architect: "campaign_architect",
  email_copywriter: "email_copywriter",

  // Execution agents
  campaign_launcher: "campaign_launcher",
  social_publisher: "social_publisher",
  budget_manager: "budget_manager",

  // Review agents
  performance_analyst: "performance_analyst",
  tracking_auditor: "tracking_auditor",
  compliance_checker: "compliance_checker",
  strategy_advisor: "strategy_advisor",

  // Cross-cutting
  optimization_engine: "optimization_engine",
  memory_writer: "memory_writer",
} as const;

export type AgentType = (typeof agentTypes)[keyof typeof agentTypes];

/**
 * Map agent types to their job family
 */
export const agentFamilyMap: Record<AgentType, JobFamily> = {
  competitor_analyst: "research",
  seo_researcher: "research",
  trend_scanner: "research",
  audience_researcher: "research",
  market_analyst: "research",

  creative_writer: "production",
  content_strategist: "production",
  campaign_architect: "production",
  email_copywriter: "production",

  campaign_launcher: "execution",
  social_publisher: "execution",
  budget_manager: "execution",

  performance_analyst: "review",
  tracking_auditor: "review",
  compliance_checker: "review",
  strategy_advisor: "review",

  optimization_engine: "review",
  memory_writer: "review",
};

/**
 * Check if a task state transition is valid for the given job family
 */
export function canTaskTransition(
  family: JobFamily,
  from: TaskState,
  to: TaskState
): boolean {
  const flow = taskFlows[family];
  const fromIndex = flow.indexOf(from);
  const toIndex = flow.indexOf(to);

  // Allow forward transitions along the flow
  if (fromIndex !== -1 && toIndex !== -1 && toIndex > fromIndex) return true;

  // Always allow transition to failed, needs_revision, or archived
  if (to === "failed" || to === "needs_revision" || to === "archived")
    return true;

  // Allow needs_revision → back to generating/researching
  if (from === "needs_revision" && (to === "generating" || to === "researching"))
    return true;

  return false;
}
