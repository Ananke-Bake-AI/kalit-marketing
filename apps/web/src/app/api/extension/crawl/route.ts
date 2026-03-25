/**
 * Extension Crawl Controller — POST /api/extension/crawl
 *
 * Two modes:
 * - "analyze": AI triages a page — extracts useful data, classifies page type,
 *   suggests which navigation links to follow next.
 * - "normalize": Takes all collected page data from a multi-page crawl and
 *   normalizes it into the canonical sync format.
 */

import { NextRequest, NextResponse } from "next/server";
import { llmComplete, parseJSON } from "@/lib/llm/client";
import type { PageAnalysis, CanonicalSyncData } from "@/lib/sync/canonical-format";

/**
 * Platform-specific knowledge about what pages are valuable for data extraction.
 * This tells the AI what to look for and what to prioritize.
 */
const PLATFORM_KNOWLEDGE: Record<string, string> = {
  x: `X Ads (ads.x.com) page types and their data value:

HIGH VALUE — always extract:
- Campaign list: Shows all campaigns with name, status, budget, impressions, clicks, spend, CTR, conversions. Usually the main table on the campaigns page.
- Campaign detail: Detailed metrics for a single campaign, often with date-range charts and breakdowns.
- Ad group list: Per-ad-group targeting and performance data within a campaign.
- Analytics/Reporting: Date-range performance data, possibly with audience breakdowns.
- Audience insights: Demographic breakdowns (age, gender, location, device, interest).

MEDIUM VALUE — extract if available:
- Creative/Ad performance: Per-ad metrics showing which creatives perform best.
- Conversion events: Event definitions and counts.
- Billing/Spend: Actual billing data and payment history.

LOW VALUE — skip:
- Settings, account info, payment methods, team management, help pages.
- Campaign creation/edit forms (empty forms, not data).
- Notification/alert pages.

NAVIGATION HINTS:
- The left sidebar usually has: Campaigns, Analytics, Events, Audiences, Creatives
- Within a campaign, tabs show: Ad groups, Ads, Analytics
- The main page at ads.x.com is usually a dashboard overview
- Look for table/grid elements — these contain the campaign data
- Metric cards at the top of pages show account-level aggregates`,
};

export async function POST(req: NextRequest) {
  const start = Date.now();
  const body = await req.json();
  const { mode, platform } = body;

  if (mode === "analyze") {
    return handleAnalyze(body, platform, start);
  }

  if (mode === "normalize") {
    return handleNormalize(body, platform, start);
  }

  return NextResponse.json({ error: "Invalid mode. Use 'analyze' or 'normalize'." }, { status: 400 });
}

async function handleAnalyze(
  body: { url: string; pageText: string; navLinks: { url: string; text: string }[]; platform: string; visited: string[] },
  platform: string,
  start: number
) {
  const { url, pageText, navLinks, visited } = body;
  const knowledge = PLATFORM_KNOWLEDGE[platform] || "";

  const navLinksText = (navLinks || [])
    .slice(0, 40)
    .map((l: { url: string; text: string }) => `- ${l.text} → ${l.url}`)
    .join("\n");

  const visitedText = (visited || []).map((u: string) => `- ${u}`).join("\n") || "(none)";

  const system = `You are an ad platform data crawler. You analyze pages from ad platform dashboards to extract campaign performance data.

${knowledge ? "PLATFORM KNOWLEDGE:\n" + knowledge + "\n\n" : ""}You will:
1. Classify what type of page this is
2. Determine if it has useful data worth extracting
3. Extract ALL useful data (campaign metrics, audience data, conversion events, etc.)
4. From the navigation links, pick which pages to visit next (max 5) to collect comprehensive data

Return ONLY a JSON object:
{
  "pageType": "campaign_list",
  "useful": true,
  "data": {
    "campaigns": [
      {
        "name": "Campaign Name",
        "platformId": "abc123",
        "status": "active",
        "objective": "conversions",
        "budget": { "daily": 50, "total": 1500 },
        "metrics": { "impressions": 12345, "clicks": 678, "spend": 123.45, "ctr": 5.5, "cpc": 0.18, "conversions": 23 }
      }
    ],
    "accountMetrics": { "impressions": 50000, "spend": 500 },
    "adGroups": [],
    "creatives": [],
    "audienceInsights": [],
    "conversionEvents": []
  },
  "nextPages": ["https://ads.x.com/analytics"]
}

RULES:
- Use raw numbers (convert "$1,234" → 1234, "5.5%" → 5.5, "12.5K" → 12500, "3.2M" → 3200000)
- Omit metrics that aren't available (don't use null)
- Only include sections in "data" that actually have content (omit empty arrays)
- "nextPages" should ONLY include URLs from the navigation links list
- Do NOT suggest pages already visited
- If the page has no useful data, set "useful": false and "data": {}
- Return ONLY raw JSON. No markdown fences.`;

  const prompt = `CURRENT PAGE: ${url}
PLATFORM: ${platform}

PAGES ALREADY VISITED:
${visitedText}

NAVIGATION LINKS ON THIS PAGE:
${navLinksText || "(none found)"}

PAGE CONTENT (first 14K chars):
${(pageText || "").slice(0, 14000)}

Analyze this page. Extract all useful data and suggest next pages to visit. JSON only.`;

  try {
    const response = await llmComplete({
      model: "claude-sonnet-4-6",
      system,
      prompt,
      maxTokens: 4096,
    });

    const elapsed = Date.now() - start;
    const responseText = response.text;

    let result: PageAnalysis;
    try {
      const cleaned = responseText.trim().replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
      result = parseJSON<PageAnalysis>(cleaned);
    } catch {
      try {
        result = parseJSON<PageAnalysis>(responseText);
      } catch {
        result = { pageType: "unknown", useful: false, data: {}, nextPages: [] };
      }
    }

    // Filter nextPages to only include unvisited URLs
    const visitedSet = new Set(visited || []);
    result.nextPages = (result.nextPages || []).filter(u => !visitedSet.has(u));

    console.log(`[extension/crawl] analyze: ${result.pageType}, useful=${result.useful}, nextPages=${result.nextPages.length}, ${elapsed}ms`);

    return NextResponse.json({ ...result, elapsed, mode: "analyze" });
  } catch (err) {
    console.error("[extension/crawl] Analyze error:", err);
    return NextResponse.json({
      pageType: "unknown",
      useful: false,
      data: {},
      nextPages: [],
      error: err instanceof Error ? err.message : "AI analysis failed",
    }, { status: 500 });
  }
}

async function handleNormalize(
  body: { platform: string; pages: Array<{ url: string; pageType: string; data: Record<string, unknown>; scrapedAt: string }> },
  platform: string,
  start: number
) {
  const { pages } = body;

  if (!pages || pages.length === 0) {
    return NextResponse.json({ error: "No pages to normalize" }, { status: 400 });
  }

  const pagesJson = JSON.stringify(pages, null, 2).slice(0, 30000);

  const system = `You normalize ad platform data collected from multiple pages into a single canonical format.

RULES:
- Merge campaign data from different pages (same campaign may appear on multiple pages with different metrics)
- Use the most complete/recent version of each metric
- Match campaigns by name (case-insensitive) — merge, don't duplicate
- All numeric values must be raw numbers (no "$", "%", "K", "M")
- Omit fields that have no data (don't use null)
- adGroups and creatives should be nested under their parent campaign if possible
- If ad group or creative data can't be associated with a specific campaign, list them at the campaign level as separate entries

Return ONLY a JSON object matching this exact schema:
{
  "platform": "${platform}",
  "syncedAt": "${new Date().toISOString()}",
  "accountOverview": { "impressions": N, "clicks": N, "spend": N, ... },
  "campaigns": [
    {
      "name": "Campaign Name",
      "platformId": "id",
      "status": "active",
      "objective": "conversions",
      "budget": { "daily": 50, "total": 1500, "currency": "USD" },
      "metrics": { "impressions": N, "clicks": N, "spend": N, "conversions": N, "ctr": N, "cpc": N, "cpa": N, "roas": N },
      "adGroups": [
        {
          "name": "Ad Group Name",
          "status": "active",
          "metrics": { ... },
          "targeting": { "locations": [], "interests": [], "keywords": [] },
          "creatives": [
            { "name": "Ad Name", "type": "tweet", "status": "active", "metrics": { ... } }
          ]
        }
      ]
    }
  ],
  "audienceInsights": [
    { "dimension": "age", "segments": [{ "label": "18-24", "metrics": { "impressions": N } }] }
  ],
  "conversionEvents": [
    { "name": "Purchase", "count": 123, "value": 4567.89 }
  ],
  "crawledPages": []
}

Return ONLY raw JSON. No markdown fences.`;

  const prompt = `Normalize the following collected data from ${platform} into a single canonical format.

COLLECTED PAGES DATA:
${pagesJson}

Merge all data into one unified response. JSON only.`;

  try {
    const response = await llmComplete({
      model: "claude-sonnet-4-6",
      system,
      prompt,
      maxTokens: 8192,
    });

    const elapsed = Date.now() - start;
    const responseText = response.text;

    let result: CanonicalSyncData;
    try {
      const cleaned = responseText.trim().replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
      result = parseJSON<CanonicalSyncData>(cleaned);
    } catch {
      try {
        result = parseJSON<CanonicalSyncData>(responseText);
      } catch {
        return NextResponse.json({ error: "Failed to parse normalized data" }, { status: 500 });
      }
    }

    // Ensure required fields
    result.platform = result.platform || platform;
    result.syncedAt = result.syncedAt || new Date().toISOString();
    result.campaigns = result.campaigns || [];
    result.crawledPages = (pages || []).map(p => ({
      url: p.url,
      pageType: p.pageType,
      scrapedAt: p.scrapedAt,
    }));

    console.log(`[extension/crawl] normalize: ${result.campaigns.length} campaigns, ${elapsed}ms`);

    return NextResponse.json({ ...result, elapsed, mode: "normalize" });
  } catch (err) {
    console.error("[extension/crawl] Normalize error:", err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : "AI normalization failed",
    }, { status: 500 });
  }
}
