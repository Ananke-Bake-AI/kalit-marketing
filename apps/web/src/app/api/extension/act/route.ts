/**
 * Extension AI Controller — POST /api/extension/act
 *
 * Two modes:
 * - "plan": Receives page snapshot + campaign data → returns fill actions only
 * - "verify": Receives post-fill snapshot → checks for errors, returns fixes or "click Next"
 *
 * This ensures every page is correctly filled before navigating.
 */

import { NextRequest, NextResponse } from "next/server";
import { llmComplete, parseJSON } from "@/lib/llm/client";
import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { getPlatformSkill } from "@/lib/extension/skills";

const LOG_DIR = join(process.cwd(), ".extension-logs");
const LOG_FILE = join(LOG_DIR, "deploy-log.json");

async function appendInteraction(interaction: Record<string, unknown>) {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    let existing: { interactions: Record<string, unknown>[] } = { interactions: [] };
    try {
      const raw = await readFile(LOG_FILE, "utf-8");
      existing = JSON.parse(raw);
    } catch { /* first write */ }
    existing.interactions.push(interaction);
    if (existing.interactions.length > 50) existing.interactions = existing.interactions.slice(-50);
    await writeFile(LOG_FILE, JSON.stringify(existing, null, 2), "utf-8");
  } catch { /* best effort */ }
}

interface Action {
  type: "fill" | "click" | "select" | "wait" | "done" | "navigate";
  fieldIndex?: number;
  buttonIndex?: number;
  value?: string;
  reason: string;
  url?: string;
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  const body = await req.json();
  const { snapshot, campaign, mode, history, platform } = body;

  if (!snapshot || !campaign) {
    return NextResponse.json({ error: "snapshot and campaign required" }, { status: 400 });
  }

  // Build field descriptions with section context
  const fields = (snapshot.fields || [])
    .filter((f: Record<string, string>) => f.label !== "(unknown)" || f.placeholder || f.name || f.section)
    .map((f: Record<string, string>) => {
      const section = f.section ? ` [section: ${f.section.slice(0, 50)}]` : "";
      const val = f.value ? ` val="${f.value.slice(0, 50)}"` : "";
      return `[F${f.index}] ${f.label || f.placeholder || f.name || "?"}${section}${val}`;
    })
    .join("\n");

  // Deduplicated buttons
  const seenButtons = new Set<string>();
  const buttons = (snapshot.buttons || [])
    .filter((b: Record<string, string>) => {
      const key = (b.text || "").trim().toLowerCase();
      if (!key || key.length > 60 || seenButtons.has(key)) return false;
      seenButtons.add(key);
      return true;
    })
    .map((b: Record<string, string>) => `[B${b.index}] ${(b.text || "").trim().slice(0, 50)}`)
    .join("\n");

  // Always send full campaign data so the AI never forgets targeting, demographics, etc.
  const campaignBrief = buildCampaignSummary(campaign);

  // Recent history
  const recentHistory = (history || []).slice(-3)
    .map((h: { step: number; actions: string[] }) => `Step ${h.step}: ${h.actions.join(", ")}`)
    .join("\n");

  // Detect review/final page
  const isReviewPage = (snapshot.fields || []).length === 0 &&
    (snapshot.buttons || []).some((b: Record<string, string>) =>
      (b.text || "").toLowerCase().includes("launch") || (b.text || "").toLowerCase().includes("save draft")
    );

  // Detect stuck (same actions repeated)
  const isStuck = (history || []).length >= 2 &&
    JSON.stringify((history || []).slice(-1)[0]?.actions) === JSON.stringify((history || []).slice(-2, -1)[0]?.actions);

  // Load platform skill — only the relevant section for current page
  const fullSkill = await getPlatformSkill(platform);
  const skill = extractRelevantSkill(fullSkill, snapshot.url, mode);

  let system: string;
  let prompt: string;

  if (isStuck) {
    // Break the loop
    system = "Return only: [{\"type\":\"done\",\"reason\":\"complete\"}]";
    prompt = "Stop.";
  } else if (isReviewPage) {
    // Final page — save and done
    system = "Return a JSON array: click Save Draft button, then done.";
    prompt = `BUTTONS:\n${buttons}\nClick "Save draft" and return done. JSON array only.`;
  } else if (mode === "verify") {
    // VERIFY MODE — keep it simple, no full skill needed
    system = `You verify a filled form. Check if fields match the campaign data.

Return ONLY a JSON array:
- If everything looks correct: [{"type":"click","buttonIndex":N,"reason":"all correct, next"},{"type":"done","reason":"page verified"}]
  (The "done" here means this page is done — the extension will handle the navigation)
- If there are errors or missing fields: return fill/select actions to fix them
- If you see error messages in the field values, return fixes

Use "type" key. JSON array only.`;

    // Include before-snapshot field values so AI can see what changed
    const beforeFields = (body.beforeSnapshot?.fields || [])
      .map((f: Record<string, string>) => `[F${f.index}] ${f.label || f.placeholder || "?"} val="${(f.value || "").slice(0, 50)}"`)
      .join("\n");

    prompt = `CAMPAIGN:\n${campaignBrief}\n\nPAGE AFTER FILLING:\n${snapshot.url}\n\nFIELDS (current):\n${fields || "(none)"}\n\n${beforeFields ? `FIELDS (before fill):\n${beforeFields}\n\n` : ""}BUTTONS:\n${buttons}\n\nERRORS ON PAGE:\n${body.errors?.join("\n") || "(none)"}\n\nAre all fields correct? Fix any issues, or click Next if everything is set. JSON array only.`;
  } else {
    // PLAN MODE: Return commands using exact selectors from the skill
    system = `You fill ad campaign forms. Return ONLY a JSON array of commands.
${skill ? "\n" + skill + "\n" : ""}
COMMANDS:
{"cmd":"fill","selector":"exact-data-test-id-v2","value":"text"}
{"cmd":"select","selector":"exact-data-test-id-v2","value":"one search term"}

RULES:
1. Use EXACT data-test-id-v2 selectors from platform knowledge
2. SKIP readonly fields (funding source, disabled inputs)
3. SKIP fields in collapsed/hidden sections (Advanced, Measurement)
4. For targeting: "select" with ONE value per command
5. Budget fields are on Page 2, NOT Page 1
6. Page 1 only needs: campaign name (CampaignName-campaignNameField)
7. Page 2 needs: ad group name, daily budget, total budget, locations, keywords, interests, follower lookalikes
8. Page 3 needs: tweet body text (contenteditable), then click Website destination, then headline + URL
9. COPY text exactly from campaign data — never rewrite
10. Ad group name = campaign "Ad Group Name", NOT campaign name

Return ONLY raw JSON array. No markdown fences, no backticks, no explanation.`;

    prompt = `CAMPAIGN:
${campaignBrief}

PAGE: ${snapshot.url}

FIELDS:
${fields || "(none)"}

${recentHistory ? `PREVIOUS:\n${recentHistory}\n\n` : ""}Return commands to fill this page. ONLY fill fields with campaign data. Skip readonly/disabled fields. JSON array, no markdown fences.`;
  }

  try {
    const response = await llmComplete({
      model: "claude-sonnet-4-6",
      system,
      prompt,
      maxTokens: 2048,
    });

    const elapsed = Date.now() - start;
    const step = (history || []).length + 1;
    const responseText = response.text;

    // Parse response — always JSON (commands or actions)
    let commands: Record<string, unknown>[] = [];
    try {
      commands = parseJSON<Record<string, unknown>[]>(responseText);
    } catch {
      // Try stripping markdown fences
      const cleaned = responseText.trim().replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
      try {
        commands = parseJSON<Record<string, unknown>[]>(cleaned);
      } catch {
        commands = [];
      }
    }

    // Normalize: support both {cmd,selector,value} and {type,fieldIndex,value} formats
    const actions: Action[] = commands.map((c) => {
      if (c.cmd) {
        // New command format with selectors
        return {
          type: (c.cmd === "select" ? "select" : c.cmd === "click" ? "click" : "fill") as Action["type"],
          value: c.value as string | undefined,
          reason: (c.reason || c.selector || "") as string,
          selector: c.selector as string | undefined,
        } as Action & { selector?: string };
      }
      // Legacy format
      return {
        type: (c.type || c.action) as Action["type"],
        fieldIndex: c.fieldIndex as number | undefined,
        buttonIndex: c.buttonIndex as number | undefined,
        value: c.value as string | undefined,
        reason: (c.reason || "") as string,
      };
    });

    console.log(`[extension/act] ${mode || "plan"} step ${step}: ${actions.length} commands, ${elapsed}ms`);

    await appendInteraction({
      step,
      mode: mode || "plan",
      timestamp: new Date().toISOString(),
      elapsed,
      tokens: response.usage?.output_tokens || 0,
      page: snapshot.url,
      aiResponse: responseText.slice(0, 3000),
      commandCount: actions.length,
      errors: body.errors || [],
    });

    return NextResponse.json({ actions, elapsed, step, mode: mode || "plan" });
  } catch (err) {
    const elapsed = Date.now() - start;
    console.error("[extension/act] Error:", err);

    await appendInteraction({
      step: (history || []).length + 1,
      mode: mode || "plan",
      timestamp: new Date().toISOString(),
      elapsed,
      error: err instanceof Error ? err.message : "Unknown",
      page: snapshot.url,
    });

    return NextResponse.json({
      error: err instanceof Error ? err.message : "AI failed",
      actions: [{ type: "done", reason: "Error — complete manually" }],
    }, { status: 500 });
  }
}

function buildCampaignSummary(campaign: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push(`Campaign Name: ${campaign.name}`);
  lines.push(`Objective: ${campaign.objective} | Budget: ${campaign.dailyBudget} ${campaign.currency}/day, ${campaign.totalBudget || "none"} total`);

  const adGroups = campaign.adGroups as Array<Record<string, unknown>> | undefined;
  if (adGroups && adGroups.length > 0) {
    for (let agIdx = 0; agIdx < adGroups.length; agIdx++) {
      const ag = adGroups[agIdx];
      lines.push(`\n--- Ad Group ${agIdx + 1} ---`);
      lines.push(`Ad Group Name: ${ag.name}`);
      const t = ag.targeting as Record<string, unknown> | undefined;
      if (t) {
        if (t.locations) lines.push(`Locations: ${JSON.stringify(t.locations)}`);
        if (t.keywords) lines.push(`Keywords: ${JSON.stringify(t.keywords)}`);
        if (t.interests) lines.push(`Interests: ${JSON.stringify(t.interests)}`);
        if (t.ageMin) lines.push(`Age: ${t.ageMin}-${t.ageMax}`);
        if (t.genders) lines.push(`Genders: ${JSON.stringify(t.genders)}`);
        if (t.followerLookalikes) lines.push(`Follower Lookalikes: ${JSON.stringify(t.followerLookalikes)}`);
      }
      const creatives = ag.creatives as Array<Record<string, unknown>> | undefined;
      if (creatives && creatives.length > 0) {
        for (let cIdx = 0; cIdx < creatives.length; cIdx++) {
          const c = creatives[cIdx];
          lines.push(`Creative ${cIdx + 1}:`);
          lines.push(`  Headline: ${c.headline}`);
          lines.push(`  Body: ${c.body}`);
          lines.push(`  CTA: ${c.callToAction || c.cta} | URL: ${c.destinationUrl}`);
        }
      }
    }
  }
  return lines.join("\n");
}

/**
 * Extract only the relevant section of the skill for the current page.
 * No need to send 30KB about all 4 pages when we're on page 1.
 */
function extractRelevantSkill(fullSkill: string, url: string, mode: string | undefined): string {
  if (!fullSkill) return "";

  // For verify mode on simple pages (few fields), use minimal context
  if (mode === "verify") {
    // Just the quick-lookup table and budget/error rules
    const sections: string[] = [];

    const lookupMatch = fullSkill.match(/## \d+\. FIELD IDENTIFICATION[\s\S]*?(?=\n## \d+\.)/i);
    if (lookupMatch) sections.push(lookupMatch[0].slice(0, 2000));

    const budgetMatch = fullSkill.match(/## \d+\. BUDGET[\s\S]*?(?=\n## \d+\.)/i);
    if (budgetMatch) sections.push(budgetMatch[0].slice(0, 1000));

    const errorMatch = fullSkill.match(/## \d+\. ERROR[\s\S]*?(?=\n## \d+\.)/i);
    if (errorMatch) sections.push(errorMatch[0].slice(0, 1000));

    if (sections.length > 0) return sections.join("\n\n");
    // Fallback: first 3000 chars
    return fullSkill.slice(0, 3000);
  }

  // For plan mode, extract the relevant page section + shared rules
  const urlLower = url.toLowerCase();
  let pageSection = "";

  if (urlLower.includes("/campaign/new") || urlLower.includes("/campaign/edit")) {
    // Page 1: Campaign setup
    pageSection = extractSection(fullSkill, /STEP 1|PAGE 1|CAMPAIGN FORM|CAMPAIGN DETAILS/i);
  } else if (urlLower.includes("/adgroup")) {
    // Page 2: Ad group (biggest page)
    pageSection = extractSection(fullSkill, /STEP 2|PAGE 2|AD GROUP/i);
  } else if (urlLower.includes("/creative") || urlLower.includes("/ad/")) {
    // Page 3: Creative
    pageSection = extractSection(fullSkill, /STEP 3|PAGE 3|CREATIVE/i);
  } else if (urlLower.includes("/review")) {
    // Page 4: Review
    pageSection = extractSection(fullSkill, /STEP 4|PAGE 4|REVIEW/i);
  }

  // Always include: field lookup table + budget rules + interaction rules + reminders
  const shared: string[] = [];

  const lookupMatch = fullSkill.match(/## \d+\. FIELD IDENTIFICATION[\s\S]*?(?=\n## \d+\.)/i);
  if (lookupMatch) shared.push(lookupMatch[0].slice(0, 3000));

  const selectMatch = fullSkill.match(/## \d+\. SELECT[\s\S]*?(?=\n## \d+\.)/i);
  if (selectMatch) shared.push(selectMatch[0].slice(0, 1500));

  const budgetMatch = fullSkill.match(/## \d+\. BUDGET[\s\S]*?(?=\n## \d+\.)/i);
  if (budgetMatch) shared.push(budgetMatch[0].slice(0, 1500));

  const creativeMatch = fullSkill.match(/## \d+\. CREATIVE PAGE[\s\S]*?(?=\n## \d+\.)/i);
  if (urlLower.includes("/creative") && creativeMatch) shared.push(creativeMatch[0].slice(0, 2000));

  const remindersMatch = fullSkill.match(/## \d+\. IMPORTANT[\s\S]*$/i);
  if (remindersMatch) shared.push(remindersMatch[0].slice(0, 2000));

  const result = [pageSection, ...shared].filter(Boolean).join("\n\n");

  // If extraction found nothing, fall back to truncated full skill
  return result.length > 200 ? result : fullSkill.slice(0, 8000);
}

function extractSection(text: string, pattern: RegExp): string {
  // Find the section header matching the pattern
  const lines = text.split("\n");
  let startIdx = -1;
  let endIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (startIdx === -1 && pattern.test(lines[i])) {
      // Found start — back up to the section header (## N.)
      startIdx = i;
      for (let j = i; j >= Math.max(0, i - 3); j--) {
        if (/^##\s+\d+\./.test(lines[j]) || /^---/.test(lines[j])) {
          startIdx = j;
          break;
        }
      }
    } else if (startIdx !== -1 && /^---$/.test(lines[i]) && i > startIdx + 5) {
      // Found end (next section separator)
      endIdx = i;
      break;
    }
  }

  if (startIdx === -1) return "";
  return lines.slice(startIdx, endIdx).join("\n").slice(0, 8000);
}
