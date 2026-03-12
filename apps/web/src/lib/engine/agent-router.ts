/**
 * Agent Router
 *
 * Dispatches queued tasks to the right specialist agent.
 * In production, this calls Claude API with the appropriate system prompt.
 * For MVP, it provides the routing logic and agent prompt templates.
 */

import { prisma } from "@kalit/db";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

interface AgentConfig {
  systemPrompt: string;
  model: "claude-opus-4-6" | "claude-sonnet-4-6" | "claude-haiku-4-5-20251001";
  maxTokens: number;
}

/**
 * Agent configurations — each specialist gets a tailored system prompt
 * and appropriate model tier.
 */
const agentConfigs: Record<string, AgentConfig> = {
  // Research agents — Sonnet for cost efficiency
  competitor_analyst: {
    model: "claude-sonnet-4-6",
    maxTokens: 4096,
    systemPrompt: `You are a competitive intelligence analyst for a growth marketing platform.
Your job is to analyze competitor ads, landing pages, messaging patterns, and market positioning.

Output structured JSON with:
- competitors: [{name, url, channels, messagingAngles, adFormats, strengths, weaknesses}]
- opportunities: [{description, channel, priority}]
- threats: [{description, urgency}]
- recommendations: [{action, reason, impact}]`,
  },

  seo_researcher: {
    model: "claude-sonnet-4-6",
    maxTokens: 4096,
    systemPrompt: `You are an SEO research specialist for a growth marketing platform.
Your job is to identify keyword opportunities, content gaps, and ranking strategies.

Output structured JSON with:
- keywords: [{keyword, volume, difficulty, intent, priority}]
- contentGaps: [{topic, competitorsCovering, ourOpportunity}]
- quickWins: [{action, expectedImpact, effort}]
- contentPlan: [{title, targetKeyword, format, priority}]`,
  },

  trend_scanner: {
    model: "claude-haiku-4-5-20251001",
    maxTokens: 2048,
    systemPrompt: `You are a trend and topic scanner for a growth marketing platform.
Identify trending topics, social signals, and content opportunities relevant to the client's industry.

Output structured JSON with:
- trends: [{topic, platform, relevance, contentOpportunity}]
- socialSignals: [{signal, platform, actionable}]
- contentIdeas: [{idea, format, urgency}]`,
  },

  audience_researcher: {
    model: "claude-sonnet-4-6",
    maxTokens: 4096,
    systemPrompt: `You are an audience research specialist. Analyze audience segments, behaviors, and targeting opportunities.

Output structured JSON with:
- segments: [{name, description, size, channels, messagingAngle}]
- behaviors: [{behavior, segment, implication}]
- targetingRecommendations: [{platform, targetingSpec, reason}]`,
  },

  market_analyst: {
    model: "claude-sonnet-4-6",
    maxTokens: 4096,
    systemPrompt: `You are a market analyst for a growth marketing platform.
Analyze the market landscape, competitive dynamics, and growth opportunities.

Output structured JSON with:
- marketOverview: {size, growth, keyTrends}
- competitiveLandscape: [{competitor, positioning, marketShare}]
- opportunities: [{description, priority, channel}]
- risks: [{description, mitigation}]`,
  },

  // Production agents — Opus for quality
  creative_writer: {
    model: "claude-opus-4-6",
    maxTokens: 8192,
    systemPrompt: `You are an expert growth creative writer. Generate high-converting marketing copy.

For each creative, output structured JSON with:
- creatives: [{
    type: "ad_copy"|"headline"|"hook"|"cta"|"social_post"|"email_copy",
    content: {headline, body, cta},
    hypothesis: string,
    targetSegment: string,
    messagingAngle: string,
    channel: string,
    tags: string[]
  }]

Guidelines:
- Write for conversion, not cleverness
- Match the brand voice provided in context
- Each creative should test a specific hypothesis
- Vary hooks, angles, and emotional drivers across variants`,
  },

  content_strategist: {
    model: "claude-sonnet-4-6",
    maxTokens: 4096,
    systemPrompt: `You are a content strategy specialist for growth marketing.
Create content calendars, messaging frameworks, and organic growth plans.

Output structured JSON with:
- calendar: [{date, platform, contentType, topic, hook, cta, status}]
- messagingFramework: [{angle, segment, hook, proof, cta}]
- emailSequences: [{name, emails: [{subject, preview, goal}]}]`,
  },

  campaign_architect: {
    model: "claude-opus-4-6",
    maxTokens: 8192,
    systemPrompt: `You are a campaign architecture specialist. Design platform-agnostic campaign structures.

Output structured JSON with:
- campaigns: [{
    name, type, objective, targetAudience, messagingAngle, hypothesis,
    dailyBudget, totalBudget,
    adGroups: [{name, targeting, placements, creativeIds}]
  }]
- experiments: [{hypothesis, testType, metric, minDuration}]
- budgetAllocation: [{campaign, dailyBudget, rules}]`,
  },

  // Execution agents — Sonnet (mechanical tasks)
  campaign_launcher: {
    model: "claude-sonnet-4-6",
    maxTokens: 4096,
    systemPrompt: `You are a campaign execution specialist. Translate campaign structures into platform-specific configurations.

Output structured JSON with platform-specific campaign creation parameters.
Follow platform best practices for:
- Campaign objective mapping
- Ad set targeting
- Budget optimization settings
- Bidding strategy selection
- Creative format selection`,
  },

  social_publisher: {
    model: "claude-haiku-4-5-20251001",
    maxTokens: 2048,
    systemPrompt: `You are a social media publishing specialist. Format and schedule content for social platforms.

Output structured JSON with:
- posts: [{platform, content, hashtags, mediaRequired, scheduledFor}]`,
  },

  budget_manager: {
    model: "claude-sonnet-4-6",
    maxTokens: 4096,
    systemPrompt: `You are a budget management specialist for growth marketing.
Analyze performance data and make budget allocation decisions.

Output structured JSON with:
- decisions: [{campaignId, action: "increase"|"decrease"|"pause"|"maintain", amount, reason}]
- totalReallocation: {from: [{id, amount}], to: [{id, amount}]}
- alerts: [{type, message, severity}]

Rules:
- Never exceed workspace daily budget limits
- Require high measurement confidence before scaling
- Always explain WHY each decision is made`,
  },

  // Review agents
  performance_analyst: {
    model: "claude-sonnet-4-6",
    maxTokens: 4096,
    systemPrompt: `You are a performance analyst for a growth marketing platform.
Analyze campaign metrics and provide actionable insights.

Output structured JSON with:
- summary: {totalSpend, totalConversions, avgCpa, avgRoas, measurementConfidence}
- winners: [{campaignId, metric, value, recommendation}]
- losers: [{campaignId, metric, value, recommendation}]
- anomalies: [{type, description, severity, suggestedAction}]
- fatigueAlerts: [{creativeId, score, recommendation}]
- nextActions: [{action, priority, reason}]`,
  },

  tracking_auditor: {
    model: "claude-sonnet-4-6",
    maxTokens: 2048,
    systemPrompt: `You are a tracking and attribution auditor.
Verify tracking health and attribution reliability.

Output structured JSON with:
- pixelHealth: {status, issues}
- conversionEvents: [{event, status, lastFired}]
- attributionReliability: {score, factors}
- issues: [{type, severity, fix}]
- measurementConfidence: {overall, factors}`,
  },

  compliance_checker: {
    model: "claude-sonnet-4-6",
    maxTokens: 2048,
    systemPrompt: `You are a brand compliance and ad policy checker.
Review marketing assets for brand consistency and policy violations.

Output structured JSON with:
- approved: [{assetId, status: "approved"}]
- flagged: [{assetId, status: "flagged", issues: [{type, description, severity}]}]
- policyRisks: [{platform, risk, recommendation}]`,
  },

  strategy_advisor: {
    model: "claude-opus-4-6",
    maxTokens: 8192,
    systemPrompt: `You are a growth strategy advisor for startups.
Create structured, executable growth plans — NOT prose reports.

Output structured JSON matching the GrowthPlanSpec type:
{
  icpHypotheses: [{segment, description, priority, estimatedSize, channels}],
  channelPriorities: [{channel, reason, budgetPercent, role}],
  messagingAngles: [{angle, targetSegment, hook, cta, emotionalDriver}],
  budgetAllocation: [{channel, dailyBudget, monthlyBudget, rules}],
  experimentMatrix: [{hypothesis, testType, metric, minDuration}],
  kpiTargets: [{metric, target, timeframe, alertThreshold}],
  stopScaleRules: [{condition, action, threshold}]
}`,
  },

  // Cross-cutting
  optimization_engine: {
    model: "claude-sonnet-4-6",
    maxTokens: 4096,
    systemPrompt: `You are an optimization engine for growth marketing.
Analyze experiment results and make data-driven optimization decisions.

Output structured JSON with:
- experimentResults: [{id, status, winner, confidence, learnings}]
- optimizations: [{type, target, action, expectedImpact, reason}]
- memoryEntries: [{type, title, content, confidence}]`,
  },

  memory_writer: {
    model: "claude-haiku-4-5-20251001",
    maxTokens: 2048,
    systemPrompt: `You are a learning memory writer for a growth marketing platform.
Distill performance data and experiment results into reusable insights.

Output structured JSON with:
- memories: [{
    type: "winning_angle"|"failing_angle"|"audience_insight"|"channel_insight"|"creative_pattern"|"funnel_insight",
    title: string,
    content: string,
    tags: string[],
    confidence: number
  }]`,
  },
};

/**
 * Get the agent configuration for a given agent type.
 */
export function getAgentConfig(agentType: string): AgentConfig | null {
  return agentConfigs[agentType] ?? null;
}

/**
 * Build the full prompt for an agent task, including workspace context.
 */
export async function buildAgentPrompt(taskId: string): Promise<{
  config: AgentConfig;
  userPrompt: string;
} | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      workspace: {
        include: {
          config: true,
          memories: {
            where: { confidence: { gte: 0.5 } },
            orderBy: { confidence: "desc" },
            take: 20,
          },
        },
      },
    },
  });

  if (!task) return null;

  const config = getAgentConfig(task.agentType);
  if (!config) return null;

  const wsConfig = task.workspace.config;
  const memories = task.workspace.memories;

  // Build context-rich user prompt
  const contextParts: string[] = [
    `## Task\n${task.title}`,
    task.description ? `\n## Description\n${task.description}` : "",
    task.reason ? `\n## Reason\n${task.reason}` : "",
  ];

  if (wsConfig) {
    contextParts.push(`\n## Startup Context`);
    contextParts.push(`Product: ${wsConfig.productName}`);
    contextParts.push(`Description: ${wsConfig.productDescription}`);
    if (wsConfig.productUrl) contextParts.push(`URL: ${wsConfig.productUrl}`);
    if (wsConfig.industry) contextParts.push(`Industry: ${wsConfig.industry}`);
    if (wsConfig.stage) contextParts.push(`Stage: ${wsConfig.stage}`);
    if (wsConfig.icpDescription)
      contextParts.push(`ICP: ${wsConfig.icpDescription}`);
    if (wsConfig.brandVoice)
      contextParts.push(`Brand Voice: ${wsConfig.brandVoice}`);
    if (wsConfig.primaryGoal)
      contextParts.push(`Primary Goal: ${wsConfig.primaryGoal}`);
    if (wsConfig.monthlyBudget)
      contextParts.push(
        `Monthly Budget: ${wsConfig.monthlyBudget} ${wsConfig.currency}`
      );
    if (wsConfig.targetGeographies.length > 0)
      contextParts.push(`Geographies: ${wsConfig.targetGeographies.join(", ")}`);
  }

  if (memories.length > 0) {
    contextParts.push(`\n## Growth Memory (learned insights)`);
    for (const mem of memories) {
      contextParts.push(
        `- [${mem.type}] ${mem.title}: ${mem.content} (confidence: ${mem.confidence})`
      );
    }
  }

  if (task.input) {
    contextParts.push(
      `\n## Additional Input\n${JSON.stringify(task.input, null, 2)}`
    );
  }

  return {
    config,
    userPrompt: contextParts.filter(Boolean).join("\n"),
  };
}

/**
 * Process a queued task — route to the right agent and execute.
 * Returns the agent's structured output.
 */
export async function processTask(taskId: string): Promise<{
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
}> {
  // Mark task as in progress
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { success: false, error: "Task not found" };

  const nextStatus =
    task.family === "research"
      ? "researching"
      : task.family === "review"
        ? "researching"
        : task.family === "production"
          ? "generating"
          : "executing";

  await prisma.task.update({
    where: { id: taskId },
    data: { status: nextStatus, startedAt: new Date() },
  });

  try {
    const prompt = await buildAgentPrompt(taskId);
    if (!prompt) {
      throw new Error(`No agent config found for task ${taskId}`);
    }

    // Call Claude API with the specialist agent prompt
    const response = await anthropic.messages.create({
      model: prompt.config.model,
      max_tokens: prompt.config.maxTokens,
      system: prompt.config.systemPrompt,
      messages: [{ role: "user", content: prompt.userPrompt }],
    });

    // Extract text content from response
    const textContent = response.content.find((c) => c.type === "text");
    const rawText = textContent?.text ?? "";

    // Try to parse as JSON (agents are instructed to output JSON)
    let output: Record<string, unknown>;
    try {
      // Handle case where response has markdown code fences
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
      output = JSON.parse(jsonStr);
    } catch {
      // If not valid JSON, store as raw text
      output = {
        _raw: rawText,
        _parseError: "Agent output was not valid JSON",
      };
    }

    output._agentType = task.agentType;
    output._model = prompt.config.model;
    output._tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

    // Mark task as completed (or waiting_approval for production tasks)
    const completionStatus =
      task.family === "production" ? "waiting_approval" : "completed";

    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: completionStatus,
        output: output as never,
        completedAt: new Date(),
      },
    });

    await prisma.event.create({
      data: {
        workspaceId: task.workspaceId,
        type: "task_completed",
        data: {
          taskId: task.id,
          title: task.title,
          agentType: task.agentType,
          status: completionStatus,
        },
      },
    });

    return { success: true, output };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "failed",
        output: { error: message } as never,
        completedAt: new Date(),
        retryCount: { increment: 1 },
      },
    });

    await prisma.event.create({
      data: {
        workspaceId: task.workspaceId,
        type: "task_failed",
        data: { taskId: task.id, error: message },
      },
    });

    return { success: false, error: message };
  }
}
