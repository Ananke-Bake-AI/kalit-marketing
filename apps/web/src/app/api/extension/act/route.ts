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
  type: "fill" | "click" | "select" | "wait" | "done" | "navigate" | "clearTokens" | "clickOption" | string;
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
    .filter((f: Record<string, unknown>) => f.label !== "(unknown)" || f.placeholder || f.name || f.section)
    .map((f: Record<string, unknown>) => {
      const section = f.section ? ` [section: ${(f.section as string).slice(0, 50)}]` : "";
      const val = f.value ? ` val="${(f.value as string).slice(0, 50)}"` : "";
      const tokens = f.tokens ? ` [${f.tokens} items already selected]` : "";
      return `[F${f.index}] ${f.label || f.placeholder || f.name || "?"}${section}${val}${tokens}`;
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

  // Detect review/final page — must match URL OR have zero fillable fields + launch button
  const urlLower = (snapshot.url || "").toLowerCase();
  const buttonTexts = (snapshot.buttons || []).map((b: Record<string, string>) => (b.text || "").toLowerCase());
  const hasLaunchBtn = buttonTexts.some((t: string) =>
    t.includes("launch campaign") || t.includes("launch")
  );
  const hasSaveDraftBtn = buttonTexts.some((t: string) =>
    t.includes("save draft") || t.includes("save as draft")
  );
  const isReviewPage =
    urlLower.includes("/review") ||
    // Zero editable fields + has Launch button = definitely review page
    ((snapshot.fields || []).length === 0 && (hasLaunchBtn || hasSaveDraftBtn));

  // Detect stuck (same actions repeated)
  const isStuck = (history || []).length >= 2 &&
    JSON.stringify((history || []).slice(-1)[0]?.actions) === JSON.stringify((history || []).slice(-2, -1)[0]?.actions);

  // Load platform skill — only the relevant section for current page
  const fullSkill = await getPlatformSkill(platform);
  const skill = extractRelevantSkill(fullSkill, snapshot.url, mode);

  let system: string;
  let prompt: string;

  // EXTRACT MODE — AI-powered campaign data extraction from ad platform pages
  if (mode === "extract") {
    const pageText = snapshot.pageText || "";

    system = `You extract campaign performance data from ad platform pages.
Return ONLY a JSON object with this exact structure:
{
  "campaigns": [
    {
      "name": "Campaign Name",
      "status": "active",
      "impressions": 12345,
      "clicks": 678,
      "spend": 123.45,
      "ctr": 5.5,
      "cpc": 0.18,
      "conversions": 23,
      "cpa": 5.37,
      "roas": 2.1,
      "engagements": 456,
      "followers": 12,
      "retweets": 34,
      "likes": 56,
      "replies": 7,
      "videoViews": 890,
      "reach": 5000,
      "frequency": 1.5
    }
  ],
  "summary": {
    "impressions": 50000,
    "clicks": 2000,
    "spend": 500.00
  }
}

Rules:
- Extract EVERY campaign visible in the page text
- Use raw numbers only (convert "$1,234" to 1234, "5.5%" to 5.5, "12.5K" to 12500, "3.2M" to 3200000)
- Omit metrics that are not available (don't use null or 0 for missing data)
- "summary" = account-level totals if visible at the top of the page
- "status" should be: active, paused, completed, draft, or removed
- Return ONLY raw JSON. No markdown fences, no explanation.`;

    prompt = `PAGE URL: ${snapshot.url}\nPLATFORM: ${platform || "unknown"}\n\nPAGE CONTENT:\n${pageText.slice(0, 14000)}\n\nExtract all campaign performance data. JSON only.`;

    try {
      const response = await llmComplete({
        model: "claude-sonnet-4-6",
        system,
        prompt,
        maxTokens: 4096,
      });

      const elapsed = Date.now() - start;
      const responseText = response.text;

      // Parse the JSON response
      let result: { campaigns?: unknown[]; summary?: Record<string, unknown> } = {};
      try {
        const cleaned = responseText.trim().replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
        result = parseJSON<{ campaigns?: unknown[]; summary?: Record<string, unknown> }>(cleaned) || {};
      } catch {
        try {
          result = parseJSON<{ campaigns?: unknown[]; summary?: Record<string, unknown> }>(responseText) || {};
        } catch {
          result = { campaigns: [], summary: {} };
        }
      }

      await appendInteraction({
        step: 0,
        mode: "extract",
        timestamp: new Date().toISOString(),
        elapsed,
        tokens: response.usage?.output_tokens || 0,
        page: snapshot.url,
        campaignsFound: (result.campaigns || []).length,
        summaryKeys: Object.keys(result.summary || {}).length,
      });

      return NextResponse.json({
        campaigns: result.campaigns || [],
        summary: result.summary || {},
        elapsed,
        mode: "extract",
      });
    } catch (err) {
      console.error("[extension/act] Extract error:", err);
      return NextResponse.json({
        campaigns: [],
        summary: {},
        error: err instanceof Error ? err.message : "AI extraction failed",
      }, { status: 500 });
    }
  }

  if (mode === "user_correction") {
    // User typed a correction in the overlay — process it
    const userMessage = body.userMessage || "";
    system = `You are helping a user fix an ad campaign form. The user typed a correction.
Return ONLY a JSON array of commands to apply the fix.
Use {"cmd":"fill","selector":"data-test-id-v2","value":"text"} for fills.
Use {"cmd":"click","selector":"data-test-id-v2"} for clicks.
Use {"cmd":"select","selector":"data-test-id-v2","value":"search term"} for dropdowns.
If the user's instruction doesn't require any page changes, return [{"type":"done","reason":"no changes needed"}].
${skill ? "\nPlatform knowledge:\n" + skill.slice(0, 2000) + "\n" : ""}
Return ONLY raw JSON array. No markdown.`;

    prompt = `USER SAYS: "${userMessage}"

CAMPAIGN:
${campaignBrief}

CURRENT PAGE: ${snapshot.url}

FIELDS:
${fields || "(none)"}

BUTTONS:
${buttons}

What commands should we execute to address the user's instruction? JSON array only.`;
  } else if (isStuck) {
    // Break the loop
    system = "Return only: [{\"type\":\"done\",\"reason\":\"complete\"}]";
    prompt = "Stop.";
  } else if (isReviewPage) {
    // Final page — find and click Save Draft/Launch button, then done
    // Try to find the exact button index for Save Draft
    const saveDraftBtn = (snapshot.buttons || []).find((b: Record<string, string>) => {
      const t = (b.text || "").toLowerCase();
      return t.includes("save draft") || t.includes("save as draft");
    });
    const launchBtn = (snapshot.buttons || []).find((b: Record<string, string>) => {
      const t = (b.text || "").toLowerCase();
      return t.includes("launch") || t.includes("publish") || t.includes("submit");
    });
    const targetBtn = saveDraftBtn || launchBtn;
    if (targetBtn) {
      // Skip AI entirely — directly return the click action
      const elapsed = Date.now() - start;
      return NextResponse.json({
        actions: [
          { type: "click", buttonIndex: (targetBtn as Record<string, unknown>).index, reason: "save draft" },
          { type: "done", reason: "review page — saved" },
        ],
        elapsed, step: (history || []).length + 1, mode: mode || "plan",
      });
    }
    system = "Return a JSON array: click Save Draft button, then done.";
    prompt = `BUTTONS:\n${buttons}\nClick "Save draft" and return done. JSON array only.`;
  } else if (mode === "verify") {
    // VERIFY MODE
    system = `You verify a filled ad form. Check fields match campaign data.

Return ONLY a JSON array:
- If ALL fields have correct values → click Next: [{"type":"click","buttonIndex":N,"reason":"correct"}]
- ONLY return fixes for fields that are EMPTY or have WRONG values
- Do NOT re-fill fields that already contain the right text, even if truncated in the display
- A field showing val="You're the founder, the gro..." with full value "You're the founder, the growth lead..." is CORRECT — do NOT re-fill it
- If there are page errors like "You need to add one photo or video" that you CANNOT fix, just click Next anyway — do not try to fix unrelated fields
- CREATIVE PAGE (Page 3) special handling:
  a. If tweet body is empty: {"cmd":"fill","selector":"tweetTextInput","value":"full tweet text"}
  b. If headline/URL fields are empty and visible: fill them
  c. After filling: click Next
- For daily budget: use selector "dailyBudget"

Use "cmd" key for selector-based commands. JSON array only, no markdown.`;

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
{"cmd":"click","selector":"exact-data-test-id-v2"}
{"cmd":"clearTokens","selector":"field-selector"} — removes all existing tokens/chips from a field
{"cmd":"clickOption","value":"visible text of the option to click"} — clicks a visible option by text (ONLY for conversion event dropdown, NOT for locations/keywords/interests/lookalikes — those use "select" which handles the dropdown automatically)

RULES:
1. Use EXACT data-test-id-v2 selectors from platform knowledge
2. SKIP readonly fields (funding source, disabled inputs)
3. SKIP fields in collapsed/hidden sections (Advanced, Measurement)
4. For targeting: "select" with ONE value per command
5. Budget fields are on Page 2, NOT Page 1
6. Page 1 only needs: campaign name via {"cmd":"fill","selector":"CampaignName-campaignNameField","value":"..."}
7. Page 2 needs: ad group name (AdGroupName-input), budgets, locations, keywords, interests, follower lookalikes
   For daily budget, use selector "dailyBudget" — the extension finds it by label text (no data-test-id exists for this field)
8. LOCATIONS: X Ads pre-fills a default country. ALWAYS clear it first before adding campaign locations:
   {"cmd":"clearTokens","selector":"targeting_criteria_location-input"}
   Then add each location with select commands.
9. CONVERSION EVENT (Goal section on Page 2): If the campaign specifies a conversion event, first click "Select an event" to open the dropdown, then click the right option:
   {"cmd":"click","selector":"Select an event"} — or the relevant button/dropdown trigger
   {"cmd":"clickOption","value":"lead generation"} — match campaign conversionEvent
   Valid options: "purchase", "lead generation", "download", "add to cart"
10. Page 3 (creative) — MUST follow this exact order:
   a. Fill tweet body: {"cmd":"fill","selector":"tweetTextInput","value":"full tweet text from creative body"}
   b. Click Website destination: {"cmd":"click","selector":"card-type-dropdown-WEBSITE"} — this REVEALS headline/URL fields
   c. Wait 500ms for fields to render: {"cmd":"wait","value":"500"}
   d. Then headline and URL fields will appear — but you WON'T see them in this snapshot. Return ONLY steps a-c for now. The verify step will handle the rest after the fields appear.
11. COPY text exactly from campaign data — never rewrite or truncate
12. Ad group name = campaign "Ad Group Name", NOT campaign name
13. Do NOT invent selector names. Only use selectors from the platform knowledge or the field list.
14. SKIP fields that already have the correct value (check the val= in the field list). Do NOT re-fill already-filled fields.
15. Fields showing "[N items already selected]" already have tokens — SKIP them unless the count doesn't match.
16. If ALL fields on this page already have correct values, return: [{"type":"done","reason":"already filled"}]

Return ONLY raw JSON array. No markdown fences, no backticks, no explanation.`;

    prompt = `CAMPAIGN:
${campaignBrief}

PAGE: ${snapshot.url}

FIELDS:
${fields || "(none)"}

${recentHistory ? `PREVIOUS:\n${recentHistory}\n\n` : ""}Return commands to fill this page. ONLY fill fields with campaign data. Skip readonly/disabled fields. JSON array, no markdown fences.`;
  }

  // Use lower token limit for verify (it just needs to say OK or return small fixes)
  const tokenLimit = mode === "verify" ? 1024 : 2048;

  try {
    const response = await llmComplete({
      model: "claude-sonnet-4-6",
      system,
      prompt,
      maxTokens: tokenLimit,
    });

    const elapsed = Date.now() - start;
    const step = (history || []).length + 1;
    const responseText = response.text;

    // Parse response — always JSON (commands or actions)
    let commands: Record<string, unknown>[] = [];
    try {
      const parsed = parseJSON<unknown>(responseText);
      commands = Array.isArray(parsed) ? parsed : [parsed]; // Wrap single object in array
    } catch {
      // Try stripping markdown fences
      const cleaned = responseText.trim().replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
      try {
        const parsed = parseJSON<unknown>(cleaned);
        commands = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        commands = [];
      }
    }

    // Normalize: support {cmd,selector}, {type,selector}, and {type,fieldIndex} formats
    const actions: Action[] = commands.map((c: Record<string, unknown>) => {
      // Determine if this uses selector-based format (either cmd or type key with a selector)
      const hasSelector = !!(c.selector || c.cmd);
      if (hasSelector) {
        const cmdType = (c.cmd || c.type || "fill") as string;
        // Pass through the type as-is for custom commands (clearTokens, clickOption, etc.)
        const knownTypes = ["fill", "select", "click", "wait", "done"];
        const resolvedType = knownTypes.includes(cmdType) ? cmdType : cmdType;
        return {
          type: resolvedType as Action["type"],
          value: c.value as string | undefined,
          reason: (c.reason || c.selector || "") as string,
          selector: c.selector as string | undefined,
        } as Action & { selector?: string };
      }
      // Legacy index-based format (no selector)
      return {
        type: (c.type || c.action || "done") as Action["type"],
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

    // Generate human-readable feedback from the actions
    const feedback = generateFeedback(actions, mode || "plan", snapshot.url);

    return NextResponse.json({ actions, elapsed, step, mode: mode || "plan", feedback });
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
  if (campaign.conversionEvent) lines.push(`Conversion Event: ${campaign.conversionEvent}`);
  if (campaign.goal) lines.push(`Goal: ${campaign.goal}`);

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

  // For verify mode: minimal context — the AI just needs to compare field values vs campaign data.
  // Sending the full skill causes timeouts on large pages (Page 2: 26 buttons, 15 fields).
  if (mode === "verify") {
    // Only include field lookup table (truncated) — no interaction rules, no step-by-step guides
    const lookupMatch = fullSkill.match(/## \d+\. FIELD IDENTIFICATION[\s\S]*?(?=\n## \d+\.)/i);
    if (lookupMatch) return lookupMatch[0].slice(0, 1500);
    // Absolute minimal fallback
    return fullSkill.slice(0, 1500);
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

/**
 * Generate a human-readable feedback message from the AI actions.
 */
function generateFeedback(actions: Action[], mode: string, url: string): string {
  const urlLower = (url || "").toLowerCase();

  // Determine which page we're on
  let page = "form";
  if (urlLower.includes("/campaign/new") || urlLower.includes("/campaign/edit")) page = "campaign details";
  else if (urlLower.includes("/adgroup")) page = "ad group targeting";
  else if (urlLower.includes("/creative")) page = "ad creative";
  else if (urlLower.includes("/review")) page = "review";

  if (mode === "plan") {
    const fills = actions.filter(a => a.type === "fill");
    const selects = actions.filter(a => a.type === "select");
    const clicks = actions.filter(a => a.type === "click");
    const clears = actions.filter(a => a.type === "clearTokens");
    const done = actions.find(a => a.type === "done");

    if (done && fills.length === 0 && selects.length === 0) {
      return page === "review" ? "Saving campaign draft..." : "Page already filled, moving on.";
    }

    const parts: string[] = [];
    if (fills.length > 0) parts.push(`Filling ${fills.length} field${fills.length > 1 ? "s" : ""}`);
    if (selects.length > 0) parts.push(`selecting ${selects.length} option${selects.length > 1 ? "s" : ""}`);
    if (clicks.length > 0) parts.push(`clicking ${clicks.length} button${clicks.length > 1 ? "s" : ""}`);
    if (clears.length > 0) parts.push("clearing default values");

    return parts.length > 0
      ? `Setting up ${page}: ${parts.join(", ")}...`
      : `Analyzing ${page}...`;
  }

  if (mode === "verify") {
    const fixes = actions.filter(a => a.type === "fill" || a.type === "select");
    const nav = actions.find(a => a.type === "click");
    const done = actions.find(a => a.type === "done");

    if (fixes.length > 0) {
      return `Fixing ${fixes.length} field${fixes.length > 1 ? "s" : ""} on ${page}...`;
    }
    if (nav || done) {
      return `${page.charAt(0).toUpperCase() + page.slice(1)} verified. Moving to next step.`;
    }
    return `Checking ${page}...`;
  }

  if (mode === "user_correction") {
    const exec = actions.filter(a => a.type !== "done");
    if (exec.length > 0) {
      return `Got it! Applying ${exec.length} change${exec.length > 1 ? "s" : ""}...`;
    }
    return "No changes needed for that.";
  }

  return `Working on ${page}...`;
}
