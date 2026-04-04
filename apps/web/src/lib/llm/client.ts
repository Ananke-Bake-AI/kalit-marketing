/**
 * LLM Client — Unified interface for Claude API calls
 *
 * Strategy:
 * 1. If ANTHROPIC_API_KEY is set and valid → use @anthropic-ai/sdk directly (fastest)
 * 2. If no API key → use @anthropic-ai/claude-agent-sdk query() with local Claude Code session
 *
 * Adapted from kalitai-compiler's ClaudeCodeLLMClient pattern.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

export interface LLMResponse {
  text: string;
}

export interface ImageInput {
  type: "base64";
  media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  data: string; // base64 encoded
}

// Model mapping for claude-agent-sdk (uses short names)
const AGENT_SDK_MODELS: Record<string, string> = {
  "claude-opus-4-6": "opus",
  "claude-sonnet-4-6": "sonnet",
  "claude-sonnet-4-5-20250929": "sonnet",
  "claude-haiku-4-5-20251001": "haiku",
  opus: "opus",
  sonnet: "sonnet",
  haiku: "haiku",
};

function hasApiKey(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!key && key !== "sk-ant-xxx" && key.startsWith("sk-ant-");
}

/**
 * Call Claude with automatic provider selection.
 */
export async function llmComplete(options: {
  model: string;
  system: string;
  prompt: string;
  maxTokens?: number;
  images?: ImageInput[];
}): Promise<LLMResponse> {
  if (hasApiKey()) {
    return callWithSDK(options);
  }
  return callWithAgentSDK(options);
}

// ── Direct Anthropic SDK (with API key) ────────────────────────

async function callWithSDK(options: {
  model: string;
  system: string;
  prompt: string;
  maxTokens?: number;
  images?: ImageInput[];
}): Promise<LLMResponse> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic();

  // Build content blocks — images first (for context), then text prompt
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp"; data: string } }
  > = [];

  if (options.images?.length) {
    for (const img of options.images) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: img.media_type as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
          data: img.data,
        },
      });
    }
  }

  content.push({ type: "text", text: options.prompt });

  const response = await client.messages.create({
    model: options.model,
    max_tokens: options.maxTokens ?? 4096,
    system: options.system,
    messages: [{ role: "user", content }],
  });

  const textContent = response.content.find((c: { type: string }) => c.type === "text");
  return { text: (textContent as { text: string })?.text ?? "" };
}

// ── Claude Agent SDK (local session, no API key) ───────────────

async function callWithAgentSDK(options: {
  model: string;
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<LLMResponse> {
  const sdkModel = (AGENT_SDK_MODELS[options.model] || "sonnet") as
    | "opus"
    | "sonnet"
    | "haiku";

  // Strip ANTHROPIC_API_KEY so the SDK uses the local Claude Code OAuth session
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  env.NODE_NO_WARNINGS = "1";

  let output = "";

  for await (const event of query({
    prompt: options.prompt,
    options: {
      systemPrompt: options.system,
      model: sdkModel,
      maxTurns: 2,
      tools: [],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      env,
    },
  })) {
    if (event.type === "assistant") {
      // Extract text content from the message content blocks
      const msg = event as {
        message?: { content?: Array<{ type: string; text?: string }> };
      };
      if (msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === "text" && block.text) {
            output += block.text;
          }
        }
      }
    } else if (event.type === "result") {
      const resultEvent = event as {
        subtype?: string;
        is_error?: boolean;
        result?: string;
      };
      if (resultEvent.is_error || resultEvent.subtype?.startsWith("error")) {
        throw new Error(
          `Claude Code SDK error: ${resultEvent.result ?? resultEvent.subtype ?? "unknown"}`
        );
      }
      if (resultEvent.result) {
        output = resultEvent.result;
      }
    }
  }

  const text = output.trim();
  if (!text) {
    throw new Error("Claude Code SDK returned empty response");
  }

  return { text };
}

/**
 * Parse JSON from Claude's response — handles both raw JSON and markdown-fenced JSON.
 */
export function parseJSON<T = unknown>(text: string): T {
  // Try direct parse first
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    /* continue */
  }

  // Strip code fences
  const fenceStripped = trimmed
    .replace(/^```(?:json)?\s*\n?/m, "")
    .replace(/\n?```\s*$/m, "");
  try {
    return JSON.parse(fenceStripped) as T;
  } catch {
    /* continue */
  }

  // Find outermost JSON object via bracket matching
  const startIdx = fenceStripped.indexOf("{");
  if (startIdx === -1) {
    throw new Error(`No JSON object found in response`);
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < fenceStripped.length; i++) {
    const ch = fenceStripped[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) {
      return JSON.parse(fenceStripped.slice(startIdx, i + 1)) as T;
    }
  }

  return JSON.parse(fenceStripped.slice(startIdx)) as T;
}
