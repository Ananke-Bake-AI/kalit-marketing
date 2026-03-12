/**
 * Canonical Growth Schema Types
 *
 * Platform-agnostic types used across the system.
 * These are the internal representations — adapters translate
 * to/from platform-specific formats (Meta, Google, etc.)
 */

// ============================================================
// GROWTH PLAN (structured strategy output from Strategy Agent)
// ============================================================

export interface GrowthPlanSpec {
  icpHypotheses: IcpHypothesis[];
  channelPriorities: ChannelPriority[];
  messagingAngles: MessagingAngle[];
  budgetAllocation: BudgetAllocation[];
  experimentMatrix: ExperimentDesign[];
  kpiTargets: KpiTarget[];
  stopScaleRules: StopScaleRule[];
}

export interface IcpHypothesis {
  segment: string;
  description: string;
  priority: "primary" | "secondary" | "exploratory";
  estimatedSize?: string;
  channels?: string[];
}

export interface ChannelPriority {
  channel: string;
  reason: string;
  budgetPercent: number;
  role: "acquisition" | "retargeting" | "awareness" | "nurture";
}

export interface MessagingAngle {
  angle: string;
  targetSegment: string;
  hook: string;
  cta: string;
  emotionalDriver: string;
}

export interface BudgetAllocation {
  channel: string;
  dailyBudget: number;
  monthlyBudget: number;
  rules: string[];
}

export interface ExperimentDesign {
  hypothesis: string;
  testType: "a_b" | "multivariate" | "holdout" | "sequential";
  metric: string;
  minDuration: string;
  minSampleSize?: number;
}

export interface KpiTarget {
  metric: string;
  target: number;
  timeframe: string;
  alertThreshold?: number;
}

export interface StopScaleRule {
  condition: string;
  action: "pause" | "scale_up" | "scale_down" | "alert" | "refresh_creative";
  threshold?: number;
}

// ============================================================
// POLICY ENGINE
// ============================================================

export interface PolicyCondition {
  field: string;
  operator:
    | "eq"
    | "neq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "contains"
    | "in"
    | "not_in";
  value: string | number | boolean | string[];
}

export interface PolicyRuleSpec {
  name: string;
  description?: string;
  conditions: PolicyCondition[];
  action: "allow" | "require_approval" | "block" | "alert";
  priority: number;
}

// ============================================================
// TASK DISPATCH
// ============================================================

export interface TaskDispatch {
  workspaceId: string;
  agentType: string;
  family: "research" | "production" | "execution" | "review";
  title: string;
  description?: string;
  input: Record<string, unknown>;
  priority: "critical" | "high" | "medium" | "low";
  trigger: "request" | "event" | "scheduled";
  reason?: string;
  parentTaskId?: string;
  scheduledFor?: Date;
}

// ============================================================
// EVENT BUS
// ============================================================

export interface GrowthEvent {
  workspaceId: string;
  type: string;
  data?: Record<string, unknown>;
  traceId?: string;
}

// ============================================================
// MEASUREMENT
// ============================================================

export interface MeasurementConfidence {
  overall: number; // 0-1
  factors: {
    pixelHealth: number;
    conversionTracking: number;
    attributionReliability: number;
    sampleSize: number;
    dataFreshness: number;
  };
}

export interface PerformanceSnapshot {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
  measurementConfidence: MeasurementConfidence;
}
