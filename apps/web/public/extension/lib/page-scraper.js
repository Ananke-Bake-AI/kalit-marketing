/**
 * Page Scraper — Extracts structured data from ad platform dashboards
 *
 * Uses the DomAnalyzer to find data tables, metric cards, and charts
 * on ad platform reporting pages. Extracts performance data in a
 * platform-agnostic format that Kalit can ingest.
 *
 * Strategy:
 * 1. Identify the page type (dashboard, campaign list, campaign detail, reporting)
 * 2. Find metric cards (big numbers: impressions, clicks, spend, etc.)
 * 3. Find data tables (campaign/ad group rows with performance columns)
 * 4. Extract and normalize all values
 * 5. Return a structured PerformanceSnapshot
 */

const PageScraper = (() => {
  /**
   * Known metric labels across ad platforms.
   * Maps various label variants to canonical metric names.
   */
  const METRIC_ALIASES = {
    impressions: ["impressions", "impr", "impr.", "views", "reach"],
    clicks: ["clicks", "link clicks", "taps"],
    spend: ["spend", "amount spent", "cost", "total spend", "budget spent", "spending"],
    ctr: ["ctr", "click-through rate", "click rate", "click-through"],
    cpc: ["cpc", "cost per click", "avg. cpc", "average cpc"],
    cpm: ["cpm", "cost per mille", "cost per 1,000 impressions", "cost per 1k"],
    conversions: ["conversions", "results", "actions", "conv.", "purchases", "leads"],
    cpa: ["cpa", "cost per action", "cost per result", "cost per conversion", "cost/result"],
    roas: ["roas", "return on ad spend", "return on spend"],
    engagements: ["engagements", "engagement", "interactions"],
    followers: ["followers", "new followers", "follower gain"],
    retweets: ["retweets", "reposts", "shares"],
    likes: ["likes", "favorites"],
    replies: ["replies", "comments"],
    videoViews: ["video views", "video plays", "views (video)"],
    frequency: ["frequency", "avg. frequency"],
    reach: ["reach", "people reached", "unique reach"],
  };

  /**
   * Identify what type of page we're on.
   */
  function identifyPageType() {
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    const bodyText = document.body.textContent?.slice(0, 5000).toLowerCase() || "";

    if (url.includes("analytics") || url.includes("reporting") || url.includes("stats")) {
      return "reporting";
    }
    if (url.includes("campaign") && (url.includes("detail") || url.match(/campaigns\/\w+/))) {
      return "campaign_detail";
    }
    if (url.includes("campaign")) {
      return "campaign_list";
    }
    if (url.includes("dashboard") || url.includes("overview")) {
      return "dashboard";
    }

    // Heuristic: if we see performance metrics, it's some kind of reporting
    const metricCount = Object.values(METRIC_ALIASES)
      .flat()
      .filter((alias) => bodyText.includes(alias)).length;
    if (metricCount >= 3) return "reporting";

    return "unknown";
  }

  /**
   * Extract metric cards — big standalone numbers with labels.
   * Common pattern: a label element + a value element nearby.
   */
  function extractMetricCards() {
    const metrics = {};
    const allAliases = Object.entries(METRIC_ALIASES);

    // Strategy 1: Find elements that look like metric values
    // (large text, numeric, with a nearby label)
    const candidates = document.querySelectorAll(
      "[class*='metric'], [class*='stat'], [class*='kpi'], [class*='summary'], " +
      "[class*='value'], [class*='number'], [data-testid*='metric'], " +
      "[class*='card'], [class*='overview']"
    );

    for (const container of candidates) {
      const text = container.textContent?.trim() || "";
      // Look for numeric values with optional currency/percentage
      const valueMatch = text.match(/([\$€£]?\s*[\d,]+\.?\d*\s*[%KMBkmb]?)/);
      if (!valueMatch) continue;

      // Find the label near this value
      const containerText = container.textContent.toLowerCase();
      for (const [metricName, aliases] of allAliases) {
        if (metrics[metricName]) continue; // already found
        for (const alias of aliases) {
          if (containerText.includes(alias)) {
            metrics[metricName] = parseMetricValue(valueMatch[1]);
            break;
          }
        }
      }
    }

    // Strategy 2: Scan all visible text for "label: value" patterns
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      if (!text || text.length > 100) continue;

      const parent = node.parentElement;
      if (!parent || !window.__kalitDomAnalyzer?.isElementVisible(parent)) continue;

      const lowerText = text.toLowerCase();
      for (const [metricName, aliases] of allAliases) {
        if (metrics[metricName]) continue;
        for (const alias of aliases) {
          if (lowerText.includes(alias)) {
            // Look for a numeric value in the next sibling or parent
            const siblings = parent.parentElement?.children || [];
            for (const sibling of siblings) {
              if (sibling === parent) continue;
              const sibText = sibling.textContent?.trim() || "";
              const valMatch = sibText.match(/^([\$€£]?\s*[\d,]+\.?\d*\s*[%KMBkmb]?)$/);
              if (valMatch) {
                metrics[metricName] = parseMetricValue(valMatch[1]);
                break;
              }
            }
          }
        }
      }
    }

    return metrics;
  }

  /**
   * Extract data from HTML tables or table-like structures.
   */
  function extractDataTables() {
    const tables = [];

    // Find real <table> elements
    const htmlTables = document.querySelectorAll("table");
    for (const table of htmlTables) {
      const extracted = extractHtmlTable(table);
      if (extracted && extracted.rows.length > 0) {
        tables.push(extracted);
      }
    }

    // Find grid/list structures that act like tables
    const gridSelectors = [
      "[role='grid']",
      "[role='table']",
      "[class*='table']",
      "[class*='grid'][class*='data']",
      "[class*='campaign-list']",
      "[class*='campaign_list']",
    ];

    for (const selector of gridSelectors) {
      const grids = document.querySelectorAll(selector);
      for (const grid of grids) {
        if (grid.tagName === "TABLE") continue; // already handled
        const extracted = extractGridStructure(grid);
        if (extracted && extracted.rows.length > 0) {
          tables.push(extracted);
        }
      }
    }

    return tables;
  }

  /**
   * Extract data from a standard HTML table.
   */
  function extractHtmlTable(table) {
    const headers = [];
    const rows = [];

    // Get headers
    const headerRow = table.querySelector("thead tr, tr:first-child");
    if (headerRow) {
      const cells = headerRow.querySelectorAll("th, td");
      for (const cell of cells) {
        headers.push(cell.textContent.trim());
      }
    }

    // Get data rows
    const bodyRows = table.querySelectorAll("tbody tr, tr:not(:first-child)");
    for (const row of bodyRows) {
      const cells = row.querySelectorAll("td");
      if (cells.length === 0) continue;

      const rowData = {};
      cells.forEach((cell, i) => {
        const header = headers[i] || `col_${i}`;
        const value = cell.textContent.trim();
        const canonicalName = resolveMetricName(header);
        rowData[canonicalName || header] = parseMetricValue(value) ?? value;
      });
      rows.push(rowData);
    }

    return { headers, rows };
  }

  /**
   * Extract data from a grid/list structure.
   */
  function extractGridStructure(grid) {
    const rows = [];

    // Find row-like children
    const rowSelectors = [
      "[role='row']",
      "[class*='row']",
      "[class*='item']",
      "[class*='campaign']",
    ];

    let rowElements = [];
    for (const sel of rowSelectors) {
      rowElements = grid.querySelectorAll(sel);
      if (rowElements.length > 1) break;
    }

    // Fall back to direct children
    if (rowElements.length <= 1) {
      rowElements = grid.children;
    }

    for (const row of rowElements) {
      const cells = row.querySelectorAll(
        "[role='cell'], [role='gridcell'], [class*='cell'], [class*='col']"
      );
      if (cells.length < 2) continue;

      const rowData = {};
      cells.forEach((cell) => {
        const text = cell.textContent.trim();
        const ariaLabel = cell.getAttribute("aria-label") || "";
        const nearby = cell.closest("[class*='column']")?.getAttribute("data-column") || "";

        // Try to identify what this cell represents
        const label = ariaLabel || nearby;
        if (label) {
          const canonical = resolveMetricName(label);
          rowData[canonical || label] = parseMetricValue(text) ?? text;
        }
      });

      if (Object.keys(rowData).length > 0) {
        rows.push(rowData);
      }
    }

    return { headers: [], rows };
  }

  /**
   * Resolve a display label to a canonical metric name.
   */
  function resolveMetricName(label) {
    const lower = label.toLowerCase().trim();
    for (const [canonical, aliases] of Object.entries(METRIC_ALIASES)) {
      for (const alias of aliases) {
        if (lower === alias || lower.includes(alias)) {
          return canonical;
        }
      }
    }
    return null;
  }

  /**
   * Parse a metric value string into a number.
   * Handles: "$1,234.56", "12.5K", "3.2M", "4.5%", "1,234"
   */
  function parseMetricValue(str) {
    if (!str || typeof str !== "string") return null;

    // Remove currency symbols and whitespace
    let cleaned = str.replace(/[\$€£\s,]/g, "");

    // Handle percentage
    if (cleaned.endsWith("%")) {
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    }

    // Handle K/M/B suffixes
    const suffixMatch = cleaned.match(/^([\d.]+)([KMBkmb])$/);
    if (suffixMatch) {
      const num = parseFloat(suffixMatch[1]);
      const multipliers = { k: 1e3, m: 1e6, b: 1e9 };
      const mult = multipliers[suffixMatch[2].toLowerCase()] || 1;
      return isNaN(num) ? null : num * mult;
    }

    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  /**
   * Full page scrape — combines all extraction methods.
   * Returns a PerformanceSnapshot ready to send to Kalit.
   */
  function scrape() {
    const pageType = identifyPageType();
    const metrics = extractMetricCards();
    const tables = extractDataTables();

    // Build campaign-level data from tables
    const campaigns = [];
    for (const table of tables) {
      for (const row of table.rows) {
        // A row is likely a campaign if it has a name-like field
        const name =
          row.name || row.campaign || row.campaign_name || row["Campaign name"] || null;
        if (name && typeof name === "string") {
          campaigns.push({
            name,
            impressions: row.impressions || null,
            clicks: row.clicks || null,
            spend: row.spend || null,
            ctr: row.ctr || null,
            cpc: row.cpc || null,
            conversions: row.conversions || null,
            cpa: row.cpa || null,
            roas: row.roas || null,
            engagements: row.engagements || null,
          });
        }
      }
    }

    return {
      platform: "x",
      pageType,
      scrapedAt: new Date().toISOString(),
      url: window.location.href,
      // Account-level summary metrics
      summary: metrics,
      // Per-campaign breakdown
      campaigns,
      // Raw table data (for debugging / AI analysis)
      rawTables: tables.map((t) => ({
        headers: t.headers,
        rowCount: t.rows.length,
        sample: t.rows.slice(0, 3),
      })),
    };
  }

  /**
   * Get compact page text for AI extraction fallback.
   * Strips excess whitespace, returns first N characters.
   */
  function getCompactPageText(maxLength = 15000) {
    const text = document.body.innerText || "";
    return text.replace(/\s+/g, " ").trim().slice(0, maxLength);
  }

  /**
   * Wait for data to appear on the page (tables, metric cards, campaign rows).
   * Returns true if data was found, false if timed out.
   */
  async function waitForData(timeoutMs = 10000) {
    const start = Date.now();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    while (Date.now() - start < timeoutMs) {
      // Look for tables
      if (document.querySelectorAll("table, [role='grid'], [role='table']").length > 0) return true;
      // Look for metric cards
      if (document.querySelectorAll("[class*='metric'], [class*='stat'], [class*='kpi']").length > 0) return true;
      // Look for campaign row elements
      if (document.querySelectorAll("[role='row']").length > 2) return true;
      // Look for numeric content in structured containers
      if (document.querySelectorAll("[class*='campaign'], [class*='Campaign']").length > 0) return true;

      await sleep(500);
    }
    return false;
  }

  return {
    identifyPageType,
    extractMetricCards,
    extractDataTables,
    parseMetricValue,
    resolveMetricName,
    scrape,
    getCompactPageText,
    waitForData,
  };
})();

window.__kalitPageScraper = PageScraper;
