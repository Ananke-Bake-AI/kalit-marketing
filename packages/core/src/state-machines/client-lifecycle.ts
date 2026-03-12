/**
 * Client Growth Workspace Lifecycle State Machine
 *
 * Defines valid states and transitions for a client workspace.
 * The backend uses this to determine what actions are available
 * and what agent tasks to trigger at each state.
 */

export const WorkspaceStates = {
  onboarding: "onboarding",
  auditing: "auditing",
  strategy_ready: "strategy_ready",
  producing: "producing",
  awaiting_approval: "awaiting_approval",
  launching: "launching",
  monitoring: "monitoring",
  optimizing: "optimizing",
  scaling: "scaling",
  anomaly_detected: "anomaly_detected",
  blocked: "blocked",
  paused: "paused",
} as const;

export type WorkspaceState =
  (typeof WorkspaceStates)[keyof typeof WorkspaceStates];

export interface StateTransition {
  from: WorkspaceState;
  to: WorkspaceState;
  trigger: string;
  autoTasks?: string[]; // agent tasks to create on transition
}

export const workspaceTransitions: StateTransition[] = [
  // Setup flow
  {
    from: "onboarding",
    to: "auditing",
    trigger: "onboarding_complete",
    autoTasks: ["audit_market", "audit_competitors", "audit_tracking"],
  },
  {
    from: "auditing",
    to: "strategy_ready",
    trigger: "audit_complete",
    autoTasks: ["generate_growth_plan"],
  },

  // Production flow
  {
    from: "strategy_ready",
    to: "producing",
    trigger: "plan_approved",
    autoTasks: [
      "generate_creatives",
      "generate_campaign_structures",
      "generate_content_calendar",
    ],
  },
  {
    from: "producing",
    to: "awaiting_approval",
    trigger: "assets_ready",
  },

  // Launch flow
  {
    from: "awaiting_approval",
    to: "launching",
    trigger: "assets_approved",
    autoTasks: [
      "launch_campaigns",
      "verify_tracking",
      "publish_scheduled_content",
    ],
  },
  {
    from: "launching",
    to: "monitoring",
    trigger: "campaigns_live",
    autoTasks: ["start_performance_monitoring"],
  },

  // Optimization flow
  {
    from: "monitoring",
    to: "optimizing",
    trigger: "sufficient_data",
    autoTasks: [
      "analyze_performance",
      "detect_fatigue",
      "evaluate_experiments",
    ],
  },
  {
    from: "optimizing",
    to: "scaling",
    trigger: "winners_identified",
    autoTasks: ["scale_winners", "reallocate_budget", "expand_audiences"],
  },
  {
    from: "scaling",
    to: "monitoring",
    trigger: "scaling_applied",
  },

  // Continuous loop
  {
    from: "optimizing",
    to: "producing",
    trigger: "refresh_needed",
    autoTasks: ["generate_new_creatives", "refresh_messaging"],
  },
  {
    from: "monitoring",
    to: "producing",
    trigger: "creative_fatigue",
    autoTasks: ["generate_replacement_creatives"],
  },

  // Anomaly handling
  {
    from: "monitoring",
    to: "anomaly_detected",
    trigger: "anomaly",
    autoTasks: ["diagnose_anomaly", "pause_affected_campaigns"],
  },
  {
    from: "optimizing",
    to: "anomaly_detected",
    trigger: "anomaly",
    autoTasks: ["diagnose_anomaly"],
  },
  {
    from: "anomaly_detected",
    to: "monitoring",
    trigger: "anomaly_resolved",
  },
  {
    from: "anomaly_detected",
    to: "blocked",
    trigger: "anomaly_critical",
  },

  // Pause/resume
  { from: "monitoring", to: "paused", trigger: "user_pause" },
  { from: "optimizing", to: "paused", trigger: "user_pause" },
  { from: "scaling", to: "paused", trigger: "user_pause" },
  { from: "paused", to: "monitoring", trigger: "user_resume" },

  // Blocked recovery
  { from: "blocked", to: "auditing", trigger: "user_unblock" },
];

/**
 * Get valid next states from current state
 */
export function getValidTransitions(
  currentState: WorkspaceState
): StateTransition[] {
  return workspaceTransitions.filter((t) => t.from === currentState);
}

/**
 * Check if a transition is valid
 */
export function canTransition(
  from: WorkspaceState,
  to: WorkspaceState
): boolean {
  return workspaceTransitions.some((t) => t.from === from && t.to === to);
}

/**
 * Get the transition object for a state change
 */
export function getTransition(
  from: WorkspaceState,
  to: WorkspaceState
): StateTransition | undefined {
  return workspaceTransitions.find((t) => t.from === from && t.to === to);
}
