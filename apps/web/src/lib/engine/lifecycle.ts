/**
 * Lifecycle Engine
 *
 * Manages workspace state transitions and auto-triggers tasks
 * when a workspace moves between lifecycle states.
 */

import { prisma, type Workspace } from "@kalit/db";
import {
  getTransition,
  canTransition,
  type WorkspaceState,
} from "@kalit/core";

export interface TransitionResult {
  success: boolean;
  workspace?: Workspace;
  tasksCreated?: string[];
  error?: string;
}

/**
 * Transition a workspace to a new lifecycle state.
 * Validates the transition, updates state, creates auto-tasks, and logs events.
 */
export async function transitionWorkspace(
  workspaceId: string,
  newState: WorkspaceState,
  trigger: string,
  reason?: string
): Promise<TransitionResult> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    return { success: false, error: "Workspace not found" };
  }

  const currentState = workspace.status as WorkspaceState;

  if (!canTransition(currentState, newState)) {
    return {
      success: false,
      error: `Invalid transition: ${currentState} → ${newState}`,
    };
  }

  const transition = getTransition(currentState, newState);

  // Update workspace state
  const updated = await prisma.workspace.update({
    where: { id: workspaceId },
    data: { status: newState },
  });

  // Log the state change event
  await prisma.event.create({
    data: {
      workspaceId,
      type: "workspace_status_changed",
      data: {
        from: currentState,
        to: newState,
        trigger,
        reason,
      },
    },
  });

  // Auto-create tasks from the transition
  const tasksCreated: string[] = [];
  if (transition?.autoTasks) {
    for (const taskType of transition.autoTasks) {
      const task = await createAutoTask(workspaceId, taskType, trigger);
      if (task) tasksCreated.push(task.id);
    }
  }

  return {
    success: true,
    workspace: updated,
    tasksCreated,
  };
}

/**
 * Auto-task definitions — maps task type strings from the state machine
 * to concrete task creation parameters.
 */
const autoTaskDefs: Record<
  string,
  {
    title: string;
    family: "research" | "production" | "execution" | "review";
    agentType: string;
    priority: "critical" | "high" | "medium" | "low";
    description: string;
  }
> = {
  // Auditing tasks
  audit_market: {
    title: "Audit market and competitors",
    family: "research",
    agentType: "market_analyst",
    priority: "high",
    description:
      "Analyze market landscape, competitors, ads library, messaging patterns, and positioning.",
  },
  audit_competitors: {
    title: "Scan competitor ads and content",
    family: "research",
    agentType: "competitor_analyst",
    priority: "high",
    description:
      "Scrape competitor ad libraries, landing pages, social content, and SEO presence.",
  },
  audit_tracking: {
    title: "Validate tracking and attribution",
    family: "review",
    agentType: "tracking_auditor",
    priority: "critical",
    description:
      "Verify pixels, conversion events, analytics setup, and attribution health.",
  },

  // Strategy tasks
  generate_growth_plan: {
    title: "Generate growth strategy plan",
    family: "production",
    agentType: "strategy_advisor",
    priority: "critical",
    description:
      "Create structured growth plan with ICP hypotheses, channel priorities, messaging angles, budget allocation, and experiment matrix.",
  },

  // Production tasks
  generate_creatives: {
    title: "Generate initial creative pack",
    family: "production",
    agentType: "creative_writer",
    priority: "high",
    description:
      "Generate ad copy variations, hooks, headlines, CTAs, and creative briefs for initial campaigns.",
  },
  generate_campaign_structures: {
    title: "Design campaign structures",
    family: "production",
    agentType: "campaign_architect",
    priority: "high",
    description:
      "Create platform-agnostic campaign structures, ad groups, targeting specs, and budget policies.",
  },
  generate_content_calendar: {
    title: "Create content calendar",
    family: "production",
    agentType: "content_strategist",
    priority: "medium",
    description:
      "Generate organic content calendar with social posts, blog topics, and email sequences.",
  },
  generate_new_creatives: {
    title: "Generate fresh creatives",
    family: "production",
    agentType: "creative_writer",
    priority: "high",
    description: "Create new creative variants based on performance learnings.",
  },
  generate_replacement_creatives: {
    title: "Replace fatigued creatives",
    family: "production",
    agentType: "creative_writer",
    priority: "high",
    description:
      "Generate replacement creatives for fatigued assets, using winning patterns from memory.",
  },
  refresh_messaging: {
    title: "Refresh messaging angles",
    family: "production",
    agentType: "content_strategist",
    priority: "medium",
    description: "Develop new messaging angles based on market changes and performance data.",
  },

  // Launch tasks
  launch_campaigns: {
    title: "Launch approved campaigns",
    family: "execution",
    agentType: "campaign_launcher",
    priority: "critical",
    description:
      "Push campaigns to ad platforms via execution adapters. Create campaigns, ad sets, and upload creatives.",
  },
  verify_tracking: {
    title: "Verify live tracking",
    family: "review",
    agentType: "tracking_auditor",
    priority: "critical",
    description: "Verify all tracking fires correctly on live campaigns before scaling.",
  },
  publish_scheduled_content: {
    title: "Publish scheduled content",
    family: "execution",
    agentType: "social_publisher",
    priority: "medium",
    description: "Publish approved organic content to social channels.",
  },

  // Monitoring tasks
  start_performance_monitoring: {
    title: "Begin performance monitoring",
    family: "review",
    agentType: "performance_analyst",
    priority: "high",
    description:
      "Start monitoring campaign performance, spend, conversions, and attribution quality.",
  },

  // Optimization tasks
  analyze_performance: {
    title: "Analyze campaign performance",
    family: "review",
    agentType: "performance_analyst",
    priority: "high",
    description:
      "Review performance metrics, identify winners/losers, and detect anomalies.",
  },
  detect_fatigue: {
    title: "Check creative fatigue",
    family: "review",
    agentType: "performance_analyst",
    priority: "medium",
    description: "Analyze creative fatigue scores and flag assets needing refresh.",
  },
  evaluate_experiments: {
    title: "Evaluate running experiments",
    family: "review",
    agentType: "performance_analyst",
    priority: "medium",
    description:
      "Check experiment results, statistical significance, and determine winners.",
  },

  // Scaling tasks
  scale_winners: {
    title: "Scale winning campaigns",
    family: "execution",
    agentType: "budget_manager",
    priority: "high",
    description: "Increase budget on winning campaigns within policy limits.",
  },
  reallocate_budget: {
    title: "Reallocate budget",
    family: "execution",
    agentType: "budget_manager",
    priority: "high",
    description:
      "Shift budget from underperformers to winners across channels.",
  },
  expand_audiences: {
    title: "Expand winning audiences",
    family: "execution",
    agentType: "campaign_launcher",
    priority: "medium",
    description: "Create lookalike audiences and expand targeting on winning segments.",
  },

  // Anomaly tasks
  diagnose_anomaly: {
    title: "Diagnose performance anomaly",
    family: "review",
    agentType: "performance_analyst",
    priority: "critical",
    description:
      "Investigate sudden performance changes, broken tracking, or spend anomalies.",
  },
  pause_affected_campaigns: {
    title: "Pause affected campaigns",
    family: "execution",
    agentType: "budget_manager",
    priority: "critical",
    description: "Pause campaigns affected by the detected anomaly to prevent budget waste.",
  },
};

async function createAutoTask(
  workspaceId: string,
  taskType: string,
  trigger: string
) {
  const def = autoTaskDefs[taskType];
  if (!def) return null;

  const task = await prisma.task.create({
    data: {
      workspaceId,
      title: def.title,
      description: def.description,
      family: def.family,
      agentType: def.agentType,
      priority: def.priority,
      trigger: "event",
      status: "queued",
      reason: `Auto-triggered by lifecycle transition: ${trigger}`,
    },
  });

  await prisma.event.create({
    data: {
      workspaceId,
      type: "task_created",
      data: {
        taskId: task.id,
        title: def.title,
        family: def.family,
        agentType: def.agentType,
        autoTriggered: true,
        trigger,
      },
    },
  });

  return task;
}
