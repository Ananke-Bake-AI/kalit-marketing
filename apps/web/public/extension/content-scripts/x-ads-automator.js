/**
 * Ad Platform Automator — AI-Driven, Plan → Fill → Verify loop
 *
 * For each page in the campaign creation flow:
 *   1. PLAN:   Snapshot → AI returns fill actions only
 *   2. FILL:   Extension executes all fills
 *   3. VERIFY: New snapshot + errors → AI checks if correct
 *              → If errors: AI returns fixes → Fill again → Re-verify
 *              → If OK: AI returns "click Next" → Extension navigates
 *   4. Wait for page change → Repeat
 *
 * Works on any ad platform — the AI reads the actual page structure.
 */

(() => {
  const analyzer = window.__kalitDomAnalyzer;
  const fillerLib = window.__kalitFormFiller;
  const scraper = window.__kalitPageScraper;

  if (!analyzer || !fillerLib) {
    console.error("[Kalit Automator] Missing dependencies");
    return;
  }

  const BUILD_VERSION = "v11";
  console.log(`[Kalit Automator] ${BUILD_VERSION} loaded on`, window.location.href);

  const MAX_PAGES = 10;
  const MAX_VERIFY_RETRIES = 1;
  let overlayEl = null;

  // Persistent log buffer
  const _logBuffer = [];

  // Track which fields have had their tokens auto-cleared (so we only clear once)
  const _clearedFields = new Set();

  /**
   * Ensure the tab is focused and active — Chrome won't render dropdowns
   * or fire proper UI events in background/unfocused tabs.
   * Calls the background script to focus the window + tab.
   */
  async function ensureTabFocused() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "FOCUS_TAB" }, () => {
        // Also call window.focus() from the content script side
        window.focus();
        resolve();
      });
    });
  }

  // Check for sync request
  chrome.runtime.sendMessage({ type: "SYNC_READY" }, async (response) => {
    if (response?.status === "ok" && response.sync) {
      await fillerLib.sleep(3000);
      await handleSync(response.sync);
    }
  });

  // Check for deployment
  chrome.runtime.sendMessage({ type: "AUTOMATOR_READY" }, async (response) => {
    if (!response || response.status !== "ok" || !response.deployment) {
      console.log("[Kalit Automator] No pending deployment");
      return;
    }

    const { campaign, platform } = response.deployment;
    _currentCampaign = campaign;
    _currentPlatform = platform;
    log(`Deploy: ${campaign.name} on ${platform}`);
    await fillerLib.sleep(1500);
    await runPlanFillVerify(campaign, platform);
  });

  // ============================================================
  // Plan → Fill → Verify Loop
  // ============================================================

  async function runPlanFillVerify(campaign, platform) {
    const history = [];
    let pageCount = 0;

    showOverlay(campaign);

    while (pageCount < MAX_PAGES) {
      pageCount++;

      // Ensure tab is focused before each page — dropdowns won't work in background tabs
      await ensureTabFocused();

      log(`\n━━ Page ${pageCount} ━━`);
      log(`URL: ${window.location.pathname}`);

      // Capture page HTML for skill generation (async, non-blocking)
      chrome.runtime.sendMessage({
        type: "CAPTURE_PAGE",
        platform,
        pageName: `Page ${pageCount}: ${document.title || window.location.pathname}`,
        pageHtml: document.documentElement.outerHTML.slice(0, 100000), // Cap at 100KB
      });

      // ── PLAN ──
      status(`Analyzing page ${pageCount}...`);
      log("PLAN: Analyzing page...");
      const planSnapshot = analyzer.apiSnapshot();
      log(`Fields: ${planSnapshot.fields.length} | Buttons: ${planSnapshot.buttons.length}`);

      const planResult = await callBackend({
        snapshot: planSnapshot,
        campaign,
        mode: "plan",
        history,
        platform,
      });

      if (!planResult || planResult.error) {
        log(`PLAN ERROR: ${planResult?.error || "no response"}`);
        status("Error — check debug log");
        break;
      }

      // Show AI feedback in the overlay
      if (planResult.feedback) status(planResult.feedback);

      const allActions = planResult.actions || [];
      // Include all actions except "done" in the fill phase.
      // Plan-mode clicks (e.g. clicking Website radio) are part of form filling, not navigation.
      const fillActions = allActions.filter(a => a.type !== "done");
      const isDone = allActions.some(a => a.type === "done") && fillActions.length === 0;

      if (isDone) {
        log("AI says: done");
        finish("Campaign setup complete", pageCount, history);
        return;
      }

      // ── FILL ──
      if (fillActions.length > 0) {
        log(`FILL: ${fillActions.length} commands`);
        for (const action of fillActions) {
          const desc = await execCommand(action);
          log(`  ${desc}`);
        }
      } else {
        log("FILL: Nothing to fill");
      }

      await fillerLib.sleep(300);

      // ── AUTO-SELECT CONVERSION EVENT ──
      // After filling Page 2, if the campaign has a conversionEvent, select it
      // This is done automatically because the dropdown has no data-test-id
      if (campaign.conversionEvent && window.location.pathname.includes("adgroup")) {
        await autoSelectConversionEvent(campaign.conversionEvent);
      }

      // ── VERIFY ──
      // For simple pages (few fields, no errors), skip AI verify and just click Next
      const postFillErrors = scanForErrors();
      const isSimplePage = planSnapshot.fields.length <= 3 && postFillErrors.length === 0;

      let verified = false;

      if (isSimplePage && fillActions.length > 0) {
        // Fast path: skip AI verify, just find and click Next
        log("VERIFY: Simple page, skipping AI check");
        addStep(`Page ${pageCount} filled`);
        const snap = analyzer.apiSnapshot();
        const nextBtn = snap.buttons.find(b => {
          const t = b.text.toLowerCase();
          return t.includes("next") || t === "continue";
        });
        if (nextBtn) {
          const el = analyzer.getButtonByIndex(nextBtn.index);
          if (el) {
            await fillerLib.clickElement(el);
            log(`NAV: Clicked "${nextBtn.text}"`);
            verified = true;
          }
        }
      }

      if (!verified) {
        status("Verifying page...");
        // Full AI verify loop (max 1 retry to keep it fast)
        for (let attempt = 0; attempt <= MAX_VERIFY_RETRIES; attempt++) {
          log(attempt === 0 ? "VERIFY: Checking page..." : `VERIFY: Retry ${attempt}...`);

          await fillerLib.sleep(300);
          const verifySnapshot = analyzer.apiSnapshot();
          const errors = scanForErrors();

          if (errors.length > 0) {
            log(`  Errors found: ${errors.join(" | ")}`);
          }

          const verifyResult = await callBackend({
            snapshot: verifySnapshot,
            beforeSnapshot: planSnapshot,
            campaign,
            mode: "verify",
            history,
            platform,
            errors,
          });

          if (!verifyResult || verifyResult.error) {
            log(`VERIFY ERROR: ${verifyResult?.error || "no response"}`);
            addStep(`Page ${pageCount}: verification error`, false);
            break;
          }

          // Show AI feedback
          if (verifyResult.feedback) status(verifyResult.feedback);

          // Check what AI returned
          const hasFixes = verifyResult.actions.some(a => a.type === "fill" || a.type === "select");
          const hasNav = verifyResult.actions.some(a => a.type === "click");
          const hasDone = verifyResult.actions.some(a => a.type === "done");

          if (hasFixes) {
            const fixCount = verifyResult.actions.filter(a => a.type === "fill" || a.type === "select").length;
            log(`VERIFY: ${fixCount} fixes needed`);
            status(`Applying ${fixCount} fix${fixCount > 1 ? "es" : ""}...`);
            for (const action of verifyResult.actions) {
              if (action.type === "fill" || action.type === "select") {
                const desc = await execCommand(action);
                log(`  Fix: ${desc}`);
              }
            }
            await fillerLib.sleep(300);
            continue;
          }

          if (hasNav || hasDone) {
            log("VERIFY: Page OK");
            addStep(`Page ${pageCount} verified`);
            const navAction = verifyResult.actions.find(a => a.type === "click");
            if (navAction) {
              const desc = await execCommand(navAction);
              log(`NAV: ${desc}`);
            }
            verified = true;

            if (hasDone && !hasNav) {
              finish("Campaign saved", pageCount, history);
              return;
            }
            break;
          }

          log("VERIFY: Unclear response, moving on");
          break;
        }
      }

      if (!verified) {
        // Fallback: try to click Next
        log("VERIFY: Failed, clicking Next...");
        const snap = analyzer.apiSnapshot();
        const nextBtn = snap.buttons.find(b => {
          const t = b.text.toLowerCase();
          return t.includes("next") || t === "continue";
        });
        if (nextBtn) {
          const el = analyzer.getButtonByIndex(nextBtn.index);
          if (el) {
            await fillerLib.clickElement(el);
            log(`NAV: Clicked "${nextBtn.text}"`);
          }
        }
      }

      // Record history
      history.push({
        step: pageCount,
        url: window.location.pathname,
        actions: _logBuffer.slice(-20).filter(l => l.includes("Fill") || l.includes("Select") || l.includes("Click")),
      });

      // Wait for page transition
      await fillerLib.sleep(800);

      // Check if page actually changed — if not, stop looping
      const newUrl = window.location.pathname;
      const prevUrl = planSnapshot.url.replace(/https?:\/\/[^/]+/, "").split("?")[0];
      if (newUrl === prevUrl) {
        // If we're on the review page and it didn't change, we're done
        if (newUrl.includes("/review")) {
          log("Review page — Save Draft clicked. Done.");
          finish("Campaign saved as draft", pageCount, history);
          return;
        }
        log("Page didn't change — might be an error or the form needs more input");
        // If page didn't change twice in a row, stop
        if (pageCount >= 2 && history.length >= 2) {
          const prevStep = history[history.length - 1];
          const prevPrevStep = history[history.length - 2];
          if (prevStep?.url === prevPrevStep?.url) {
            log("Stuck on same page — stopping.");
            finish("Stopped — complete manually", pageCount, history);
            return;
          }
        }
      }

      flushLogs();
    }

    if (pageCount >= MAX_PAGES) {
      log(`Hit page limit (${MAX_PAGES})`);
    }

    flushLogs();
    showOverlayDone("Stopped — review and complete manually", pageCount);
    chrome.runtime.sendMessage({
      type: "DEPLOY_COMPLETE", platform: "x", success: false,
      details: { pages: pageCount, history },
    });
  }

  // ============================================================
  // Backend Communication
  // ============================================================

  async function callBackend(payload) {
    try {
      return await withTimeout(
        new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { type: "AI_ACT", payload },
            (response) => {
              if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
              else if (response?.error && !response.actions) reject(new Error(response.error));
              else resolve(response);
            }
          );
        }),
        BACKEND_TIMEOUT,
        "Backend timeout"
      );
    } catch (err) {
      return { error: err.message, actions: [] };
    }
  }

  // ============================================================
  // Command Execution — handles both selector-based and index-based actions
  // ============================================================

  async function execCommand(action) {
    // If action has a buttonIndex or fieldIndex, go straight to legacy handler
    // (verify mode returns these — don't treat the reason text as a selector)
    if (action.buttonIndex !== undefined || action.fieldIndex !== undefined) {
      return await execAction(action);
    }

    // Determine the real selector — only use action.reason as selector if it
    // looks like one (short, no long sentences). Long reason texts are just descriptions.
    let selector = action.selector;
    if (!selector && action.reason && action.reason.length < 80 && !/\s{2,}/.test(action.reason)) {
      selector = action.reason;
    }

    // Selector-based commands (from new command format)
    if (selector && action.type === "fill") {
      const el = findElement(selector);
      if (!el) return `FILL "${selector}": NOT FOUND`;
      // Skip if the field already has the correct value (lenient: handles truncation)
      const currentVal = (el.value || el.textContent || "").trim();
      const targetVal = (action.value || "").trim();
      if (currentVal && targetVal) {
        // Exact match, or the field starts with the target (truncated display), or vice versa
        if (currentVal === targetVal ||
            (currentVal.length > 20 && targetVal.startsWith(currentVal.slice(0, 20))) ||
            (targetVal.length > 20 && currentVal.startsWith(targetVal.slice(0, 20)))) {
          return `FILL "${selector}": ALREADY SET (skipped)`;
        }
      }
      await helpers.fill(selector, action.value || "");
      return `FILL "${selector}" = "${(action.value || "").slice(0, 60)}"`;
    }

    if (selector && action.type === "select") {
      // If the selector is for a radio button / non-input (like card-type-dropdown-WEBSITE),
      // just click it instead of trying to type into it
      const el = findElement(selector);
      if (el && (el.getAttribute("role") === "radio" || el.tagName === "BUTTON")) {
        await fillerLib.clickElement(el);
        await fillerLib.sleep(500); // Wait for conditional fields to render
        return `CLICK RADIO "${selector}"`;
      }
      await helpers.selectFromDropdown(selector, action.value || "");
      return `SELECT "${action.value}" in "${selector}"`;
    }

    if (selector && action.type === "click") {
      const el = findElement(selector);
      if (!el) return `CLICK "${selector}": NOT FOUND`;
      await fillerLib.clickElement(el);
      await fillerLib.sleep(300);
      return `CLICK "${selector}"`;
    }

    // clearTokens: remove all existing tokens near a field (e.g. default locations)
    if (action.type === "clearTokens" && selector) {
      const removed = await clearTokensNearField(selector);
      return `CLEAR TOKENS near "${selector}": removed ${removed}`;
    }

    // clickOption: click a visible element by its text content (for dropdowns without data-test-id)
    if (action.type === "clickOption" && action.value) {
      const clicked = await clickVisibleOptionByText(action.value);
      return clicked ? `CLICK OPTION "${action.value}"` : `CLICK OPTION "${action.value}": NOT FOUND`;
    }

    // Fall back to legacy index-based execution
    return await execAction(action);
  }

  /**
   * Remove all token chips near a field by clicking their close buttons.
   * Used to clear default locations before adding campaign-specified ones.
   */
  async function clearTokensNearField(inputSelector) {
    const el = findElement(inputSelector);
    if (!el) return 0;

    // Walk up from the input to find the container with tokens
    let container = el.parentElement;
    let tokens = [];
    for (let d = 0; d < 6 && container; d++) {
      tokens = Array.from(container.querySelectorAll('[data-test-id-v2="token"]'));
      if (tokens.length > 0) break;
      container = container.parentElement;
    }

    let removed = 0;
    for (const token of tokens) {
      // Find the close/remove button inside or next to the token
      const closeBtn = token.querySelector('[role="button"], button, [aria-label*="remove"], [aria-label*="Remove"], [aria-label*="close"], [aria-label*="delete"]')
        || token.querySelector('svg')?.closest('[role="button"], button')
        || token.querySelector('[class*="close"], [class*="remove"], [class*="delete"]');

      if (closeBtn) {
        await fillerLib.clickElement(closeBtn);
        await fillerLib.sleep(200);
        removed++;
      } else {
        // Try clicking the × character if visible
        for (const child of token.querySelectorAll('span, div')) {
          const text = child.textContent.trim();
          if (text === '×' || text === '✕' || text === '✖' || text === 'x' || text === 'X') {
            await fillerLib.clickElement(child);
            await fillerLib.sleep(200);
            removed++;
            break;
          }
        }
      }
    }

    return removed;
  }

  /**
   * Click a visible option/item by its text content.
   * Useful for custom dropdowns that don't have data-test-id attributes,
   * like the conversion event picker.
   */
  async function clickVisibleOptionByText(text) {
    const textLower = text.toLowerCase();

    // Look through common option containers
    const selectors = [
      "[role='option']", "[role='menuitem']", "[role='listbox'] > *",
      "li", "[class*='option']", "[class*='item']", "[class*='Option']",
      "[class*='MenuItem']", "[class*='ListItem']",
    ];

    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (el.textContent.toLowerCase().includes(textLower) && analyzer.isElementVisible(el)) {
          await fillerLib.clickElement(el);
          await fillerLib.sleep(300);
          return true;
        }
      }
    }

    // Broader search: any visible element with matching text
    for (const el of document.querySelectorAll("div, span, button, a, p")) {
      const elText = el.textContent.trim().toLowerCase();
      if (elText.includes(textLower) && elText.length < 100 && analyzer.isElementVisible(el) && el.offsetHeight < 80) {
        await fillerLib.clickElement(el);
        await fillerLib.sleep(300);
        return true;
      }
    }

    return false;
  }

  /**
   * Auto-select the conversion event on the ad group page.
   * Finds "Select an event" dropdown trigger, clicks it, then clicks the matching option.
   */
  async function autoSelectConversionEvent(conversionEvent) {
    // Check if conversion event is already selected (look for the text on page)
    const eventLower = conversionEvent.toLowerCase();

    // Look for "Select an event" button/dropdown trigger
    let triggerEl = null;
    for (const el of document.querySelectorAll("div, button, span, a")) {
      const text = (el.textContent || "").trim().toLowerCase();
      if (text === "select an event" && analyzer.isElementVisible(el) && el.offsetHeight < 60) {
        triggerEl = el;
        break;
      }
    }

    if (!triggerEl) {
      // Maybe already selected or not on this page variant
      log("  conversion event: 'Select an event' not found, skipping");
      return;
    }

    log(`  conversion event: clicking dropdown...`);
    await ensureTabFocused();
    await fillerLib.clickElement(triggerEl);
    await fillerLib.sleep(800); // Wait for dropdown to open

    // Now find and click the matching option
    const clicked = await clickVisibleOptionByText(conversionEvent);
    if (clicked) {
      log(`  conversion event: selected "${conversionEvent}"`);
    } else {
      // Try partial matches
      const partials = ["lead", "purchase", "download", "add to cart"];
      const match = partials.find(p => eventLower.includes(p));
      if (match) {
        const retried = await clickVisibleOptionByText(match);
        log(`  conversion event: ${retried ? `selected "${match}"` : "NOT FOUND"}`);
      } else {
        log(`  conversion event: "${conversionEvent}" NOT FOUND in dropdown`);
      }
    }

    await fillerLib.sleep(300);
  }

  /**
   * Check if a token (tag chip) already exists on the page for this value.
   * X Ads shows selected locations/keywords/interests/lookalikes as token elements
   * with data-test-id-v2="token". The input field itself stays empty.
   * This prevents re-filling fields that were already set on a previous sub-page.
   */
  function isTokenAlreadyPresent(searchText) {
    const searchLower = searchText.toLowerCase().replace(/^@/, ""); // strip @ for lookalikes
    const tokens = document.querySelectorAll('[data-test-id-v2="token"], [class*="Token"], [class*="tag"], [class*="chip"]');
    for (const token of tokens) {
      const text = (token.textContent || "").toLowerCase();
      if (text.includes(searchLower)) return true;
    }
    return false;
  }

  /**
   * Generate alternative search terms when the original doesn't match X's autocomplete.
   * Uses two strategies:
   *   1. Try the first word only (e.g. "Artificial intelligence" → "Artificial")
   *   2. Try known mappings (e.g. "SaaS" → "Enterprise software", "Venture capital" → "Investors")
   * This is a dynamic fallback — if X changes their taxonomy, shorter terms still work.
   */
  function getAlternativeSearchTerms(original) {
    const lower = original.toLowerCase();
    const alts = [];

    // Known mappings for terms that don't exist in X's taxonomy
    const mappings = {
      "saas": ["Enterprise software", "Business software"],
      "artificial intelligence": ["Tech news", "Computer programming"],
      "ai": ["Tech news", "Computer programming"],
      "developer tools": ["Computer programming", "Open source"],
      "venture capital": ["Investors and patents", "Beginning investing"],
      "product management": ["Leadership", "Business news"],
      "growth hacking": ["Marketing", "Small business"],
      "software development": ["Computer programming", "Open source"],
      "machine learning": ["Tech news", "Science news"],
      "cloud computing": ["Enterprise software", "Computer networking"],
      "cybersecurity": ["Network security"],
      "blockchain": ["Tech news", "Investing"],
      "fintech": ["Financial news", "Tech news"],
      "devops": ["Computer networking", "Computer programming"],
      "ux design": ["Web design", "Design"],
      "data science": ["Databases", "Science news"],
      "e-commerce": ["Small business", "Shopping"],
      "remote work": ["Career news and general info", "Small business"],
    };

    // Check exact mappings
    if (mappings[lower]) {
      alts.push(...mappings[lower]);
    }

    // Try first word if multi-word (e.g. "Artificial intelligence" → "Artificial")
    const words = original.split(/\s+/);
    if (words.length > 1 && words[0].length >= 4) {
      alts.push(words[0]);
    }

    // Try without common suffixes
    if (lower.endsWith("ing")) alts.push(original.slice(0, -3));
    if (lower.endsWith("ment")) alts.push(original.slice(0, -4));

    return alts.slice(0, 3); // Max 3 alternatives to keep it fast
  }

  /**
   * Score a dropdown suggestion to prefer exact/country matches over partial/region matches.
   * Higher score = better match. Used for both location and interest dropdowns.
   *
   * Examples for searchText="France":
   *   "Country — France" → 100 (country prefix)
   *   "France" → 90 (exact match)
   *   "Ile-de-France, FR" → 10 (partial match, longer text)
   */
  function scoreSuggestion(elementText, searchText) {
    const text = elementText.trim();
    const textLower = text.toLowerCase();
    const searchLower = searchText.toLowerCase();

    if (!textLower.includes(searchLower)) return 0;

    let score = 10; // Base: contains search term

    // Exact match (text IS the search term)
    if (textLower === searchLower) score += 80;

    // Starts with "Country —" (X Ads location format)
    if (textLower.startsWith("country")) score += 90;

    // Text after " — " is an exact match (e.g. "Country — France")
    const afterDash = text.split(/\s*[—–-]\s*/).pop()?.trim().toLowerCase();
    if (afterDash === searchLower) score += 70;

    // Shorter text is usually more specific (country vs region)
    if (text.length < 30) score += 20;
    if (text.length < 15) score += 10;

    // Penalize if it looks like a region/state
    if (/region|state|province|city|metro/i.test(text)) score -= 40;

    return score;
  }

  /**
   * From a list of candidate elements, pick the one with the highest suggestion score.
   */
  function pickBestMatch(candidates, searchText) {
    let bestEl = null;
    let bestScore = 0;
    for (const el of candidates) {
      const s = scoreSuggestion(el.textContent || "", searchText);
      if (s > bestScore) {
        bestScore = s;
        bestEl = el;
      }
    }
    return bestEl;
  }

  /**
   * Type into a search field like a human, wait for dropdown to appear, click best match.
   * Key difference from fillField: types each char with delays + InputEvent so autocomplete triggers.
   */
  async function selectFromDropdown(inputSelector, searchText) {
    const el = findElement(inputSelector);
    if (!el) { log(`  select: "${inputSelector}" NOT FOUND`); return false; }

    // Auto-clear: on first use of a location field, remove default tokens (e.g. Malta)
    // so we only have campaign-specified locations
    if (!_clearedFields.has(inputSelector)) {
      _clearedFields.add(inputSelector);
      // Only auto-clear location fields (they have pre-filled defaults)
      if (inputSelector.includes("location")) {
        const removed = await clearTokensNearField(inputSelector);
        if (removed > 0) {
          log(`  auto-clear: removed ${removed} default tokens from "${inputSelector}"`);
          await fillerLib.sleep(300);
        }
      }
    }

    // Check if a token already exists for this value — skip if already selected
    // (X Ads shows selected items as token elements, not as input values)
    if (isTokenAlreadyPresent(searchText)) {
      log(`  select: "${searchText}" → ALREADY EXISTS (token found), skipping`);
      return true;
    }

    // Ensure tab is focused — dropdowns won't render in background tabs
    await ensureTabFocused();

    // Click to focus
    await fillerLib.clickElement(el);
    await fillerLib.sleep(300);

    // Clear existing text
    el.focus();
    try {
      // Select all + delete
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA", ctrlKey: true, metaKey: true, bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", code: "Backspace", bubbles: true }));
      if (el.value !== undefined) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        if (setter) setter.call(el, "");
        else el.value = "";
      }
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
    } catch (e) { /* ignore */ }
    await fillerLib.sleep(200);

    // Snapshot before typing to detect new dropdown elements
    const preType = new Set();
    document.querySelectorAll("*").forEach(e => preType.add(e));

    // Type search term CHARACTER BY CHARACTER with proper events
    // This is critical — X's autocomplete only triggers on real-feeling InputEvents
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    for (let i = 0; i < searchText.length; i++) {
      const char = searchText[i];
      const currentValue = searchText.slice(0, i + 1);

      el.dispatchEvent(new KeyboardEvent("keydown", {
        key: char, code: `Key${char.toUpperCase()}`, bubbles: true,
      }));

      // Set value via native setter (React-compatible)
      if (nativeSetter) nativeSetter.call(el, currentValue);
      else el.value = currentValue;

      // Dispatch InputEvent with insertText type — this is what triggers autocomplete
      el.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: char,
      }));

      el.dispatchEvent(new KeyboardEvent("keyup", {
        key: char, code: `Key${char.toUpperCase()}`, bubbles: true,
      }));

      // Delay between characters — slow enough for the UI to react
      await fillerLib.sleep(50);
    }

    // After typing, dispatch change to finalize
    el.dispatchEvent(new Event("change", { bubbles: true }));

    // Now wait for the dropdown to appear and pick the best match
    const searchLower = searchText.toLowerCase();
    let found = false;

    // Wait up to 6 seconds, checking every 400ms — autocomplete APIs can be slow
    for (let wait = 0; wait < 15 && !found; wait++) {
      await fillerLib.sleep(400);

      // Collect all visible candidates from multiple sources
      const candidates = [];

      // Strategy 1: ARIA role=option
      for (const opt of document.querySelectorAll("[role='option']")) {
        if (opt.textContent.toLowerCase().includes(searchLower) && analyzer.isElementVisible(opt)) {
          candidates.push(opt);
        }
      }

      // Strategy 2: aria-controls listbox
      if (el.getAttribute("aria-expanded") === "true") {
        const ctrlId = el.getAttribute("aria-controls");
        if (ctrlId) {
          const lb = document.getElementById(ctrlId);
          if (lb) {
            for (const item of lb.querySelectorAll("[role='option'], li, div")) {
              if (item.textContent.toLowerCase().includes(searchLower) && analyzer.isElementVisible(item)) {
                candidates.push(item);
              }
            }
          }
        }
      }

      // Strategy 3: New elements that appeared after typing
      for (const elem of document.querySelectorAll("div, li, span, button")) {
        if (preType.has(elem)) continue;
        const t = elem.textContent?.trim() || "";
        if (t.toLowerCase().includes(searchLower) && t.length > 0 && t.length < 150 &&
            analyzer.isElementVisible(elem) && elem.offsetHeight < 100) {
          candidates.push(elem);
        }
      }

      // Strategy 4: Portals and overlays
      for (const portal of document.querySelectorAll("[class*='Portal'], [class*='Popover'], [class*='Menu'], [class*='Overlay']")) {
        for (const item of portal.querySelectorAll("div, li, button")) {
          if (item.textContent.toLowerCase().includes(searchLower) &&
              item.textContent.trim().length < 150 && analyzer.isElementVisible(item)) {
            candidates.push(item);
          }
        }
      }

      // Pick best match using scoring (prefers Country over Region, exact over partial)
      if (candidates.length > 0) {
        const best = pickBestMatch(candidates, searchText);
        if (best) {
          log(`  select: "${searchText}" → found ${candidates.length} options, picking best`);
          await fillerLib.clickElement(best);
          found = true;
          break;
        }
      }
    }

    // If not found, try a shorter/alternative search term (dynamic fallback)
    // This handles cases where the AI-generated name doesn't exactly match X's taxonomy
    if (!found && searchText.length > 4) {
      const altTerms = getAlternativeSearchTerms(searchText);
      for (const alt of altTerms) {
        log(`  select: "${searchText}" not found, trying "${alt}"...`);

        // Clear and retype with alternative term
        el.focus();
        const clearSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        if (clearSetter) clearSetter.call(el, "");
        else el.value = "";
        el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
        await fillerLib.sleep(200);

        // Type alternative term
        const altSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        for (let ci = 0; ci < alt.length; ci++) {
          const ch = alt[ci];
          el.dispatchEvent(new KeyboardEvent("keydown", { key: ch, code: `Key${ch.toUpperCase()}`, bubbles: true }));
          if (altSetter) altSetter.call(el, alt.slice(0, ci + 1));
          else el.value = alt.slice(0, ci + 1);
          el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: ch }));
          el.dispatchEvent(new KeyboardEvent("keyup", { key: ch, code: `Key${ch.toUpperCase()}`, bubbles: true }));
          await fillerLib.sleep(50);
        }

        // Wait for dropdown
        const altLower = alt.toLowerCase();
        for (let wait = 0; wait < 8 && !found; wait++) {
          await fillerLib.sleep(400);
          const candidates = [];
          for (const opt of document.querySelectorAll("[role='option']")) {
            if (opt.textContent.toLowerCase().includes(altLower) && analyzer.isElementVisible(opt)) {
              candidates.push(opt);
            }
          }
          if (candidates.length > 0) {
            const best = pickBestMatch(candidates, alt);
            if (best) {
              await fillerLib.clickElement(best);
              found = true;
              log(`  select: "${alt}" → CLICKED (fallback)`);
            }
          }
        }
        if (found) break;
      }
    }

    // Last resort: press Enter
    if (!found) {
      log(`  select: "${searchText}" → no dropdown appeared, pressing Enter`);
      el.focus();
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
      await fillerLib.sleep(100);
      el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
      await fillerLib.sleep(300);
    }

    // Verify token appeared
    await fillerLib.sleep(300);
    const tokens = document.querySelectorAll('[data-test-id-v2="token"]');
    const tokenFound = Array.from(tokens).some(t => t.textContent.toLowerCase().includes(searchLower));

    log(`  select: "${searchText}" → ${found ? "CLICKED" : "ENTER"} ${tokenFound ? "TOKEN OK" : ""}`);
    return found || tokenFound;
  }

  // Helper object for execCommand
  const helpers = {
    fill: async (selector, value) => {
      const el = findElement(selector);
      if (!el) return false;
      await fillerLib.fillField(el, value);
      await fillerLib.sleep(100);
      return true;
    },
    click: async (selector) => {
      const el = findElement(selector);
      if (!el) return false;
      await fillerLib.clickElement(el);
      await fillerLib.sleep(200);
      return true;
    },
    selectFromDropdown,
  };

  /**
   * Find an element by various selector strategies.
   * Tries: data-test-id-v2, data-test-id, data-testid, CSS selector, id.
   * For contenteditable containers, returns the editable child.
   */
  function findElement(selector) {
    // Special alias: dailyBudget — find by label text since this field has no data-test-id
    if (selector === "dailyBudget" || selector === "daily_budget" || selector === "dailyAdGroupBudget") {
      return findByLabelText("Daily ad group budget") ||
             findByLabelText("Daily budget") ||
             findByPlaceholder("0.00");
    }

    // Try data-test-id-v2 first
    let el = document.querySelector(`[data-test-id-v2="${selector}"]`);
    if (el) return resolveEditable(el);

    // Try data-test-id
    el = document.querySelector(`[data-test-id="${selector}"]`);
    if (el) return resolveEditable(el);

    // Try data-testid
    el = document.querySelector(`[data-testid="${selector}"]`);
    if (el) return resolveEditable(el);

    // Try as CSS selector directly
    try {
      el = document.querySelector(selector);
      if (el) return resolveEditable(el);
    } catch { /* invalid selector */ }

    // Try by id
    el = document.getElementById(selector);
    if (el) return resolveEditable(el);

    // No general label-text fallback — it's too aggressive and fills wrong fields.
    // Only explicit aliases (dailyBudget etc.) use findByLabelText, handled above.
    return null;
  }

  /**
   * Find an input field by its associated label text.
   * Walks the DOM looking for text matching the label, then returns the nearby input.
   */
  function findByLabelText(labelText) {
    const labelLower = labelText.toLowerCase();

    // Strategy 1: Check all <label> elements
    for (const label of document.querySelectorAll("label")) {
      if (label.textContent.trim().toLowerCase().includes(labelLower)) {
        // If label has a 'for' attribute, find the target input
        if (label.htmlFor) {
          const target = document.getElementById(label.htmlFor);
          if (target) return resolveEditable(target);
        }
        // Otherwise look for input inside/near the label
        const input = label.querySelector("input, textarea, select");
        if (input) return input;
        // Check next sibling
        const next = label.nextElementSibling;
        if (next) {
          const inp = next.matches("input, textarea") ? next : next.querySelector("input, textarea");
          if (inp) return inp;
        }
      }
    }

    // Strategy 2: Find text nodes containing the label, walk to nearest input
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.textContent.trim().toLowerCase().includes(labelLower)) {
        // Walk up to find containing form group, then find its input
        let parent = node.parentElement;
        for (let depth = 0; depth < 6 && parent; depth++) {
          const input = parent.querySelector("input:not([type='hidden']):not([type='checkbox']):not([type='radio']), textarea");
          if (input && analyzer.isElementVisible(input)) return input;
          parent = parent.parentElement;
        }
      }
    }

    return null;
  }

  /**
   * Find the first visible input with a given placeholder value.
   */
  function findByPlaceholder(placeholder) {
    for (const el of document.querySelectorAll(`input[placeholder="${placeholder}"]`)) {
      if (analyzer.isElementVisible(el)) return el;
    }
    return null;
  }

  /**
   * If an element is a container with a contenteditable child (like X's tweet composer),
   * return the actual editable element instead of the container.
   */
  function resolveEditable(el) {
    if (!el) return null;

    // If the element itself is editable, return it
    if (el.hasAttribute("contenteditable") && el.getAttribute("contenteditable") !== "false") {
      return el;
    }

    // Check for a contenteditable child (e.g. tweetTextInput container → TweetTextInput-editor)
    const editable = el.querySelector("[contenteditable='true'], [contenteditable='plaintext-only']");
    if (editable) return editable;

    // Check for an input/textarea child
    const input = el.querySelector("input:not([type='hidden']), textarea");
    if (input) return input;

    return el;
  }

  // ============================================================
  // Action Execution (legacy JSON actions — still used by verify mode)
  // ============================================================

  async function execAction(action) {
    switch (action.type) {
      case "fill": {
        const el = analyzer.getFieldByIndex(action.fieldIndex);
        if (!el) return `Fill F${action.fieldIndex}: NOT FOUND`;
        await fillerLib.fillField(el, action.value || "");
        await fillerLib.sleep(100);
        return `Fill F${action.fieldIndex}: "${(action.value || "").slice(0, 80)}"`;
      }

      case "click": {
        const el = analyzer.getButtonByIndex(action.buttonIndex);
        if (!el) return `Click B${action.buttonIndex}: NOT FOUND`;
        await fillerLib.clickElement(el);
        await fillerLib.sleep(300);
        return `Click B${action.buttonIndex}: ${action.reason || ""}`;
      }

      case "select": {
        const el = analyzer.getFieldByIndex(action.fieldIndex);
        if (!el) return `Select F${action.fieldIndex}: NOT FOUND`;
        const searchTerm = (action.value || "").trim();
        if (!searchTerm) return `Select F${action.fieldIndex}: EMPTY VALUE`;

        // Check if token already exists — skip if already selected
        if (isTokenAlreadyPresent(searchTerm)) {
          return `Select F${action.fieldIndex}: "${searchTerm}" ALREADY EXISTS (skipped)`;
        }

        // Ensure tab is focused — dropdowns won't render in background tabs
        await ensureTabFocused();

        // Step 1: Click the input to focus it
        await fillerLib.clickElement(el);
        await fillerLib.sleep(300);

        // Step 2: Clear existing text
        el.focus();
        try {
          el.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA", ctrlKey: true, metaKey: true, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", code: "Backspace", bubbles: true }));
          if (el.value !== undefined) {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
            if (setter) setter.call(el, "");
            else el.value = "";
          }
          el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
        } catch (e) { /* ignore */ }
        await fillerLib.sleep(200);

        // Step 3: Record what's on the page before typing (to detect new dropdown elements)
        const preTypeSnapshot = new Set();
        document.querySelectorAll("*").forEach(e => preTypeSnapshot.add(e));

        // Step 4: Type search term CHARACTER BY CHARACTER with InputEvent
        const legacySetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        for (let ci = 0; ci < searchTerm.length; ci++) {
          const ch = searchTerm[ci];
          const partialValue = searchTerm.slice(0, ci + 1);

          el.dispatchEvent(new KeyboardEvent("keydown", {
            key: ch, code: `Key${ch.toUpperCase()}`, bubbles: true,
          }));

          if (legacySetter) legacySetter.call(el, partialValue);
          else el.value = partialValue;

          el.dispatchEvent(new InputEvent("input", {
            bubbles: true, inputType: "insertText", data: ch,
          }));

          el.dispatchEvent(new KeyboardEvent("keyup", {
            key: ch, code: `Key${ch.toUpperCase()}`, bubbles: true,
          }));

          await fillerLib.sleep(50);
        }
        el.dispatchEvent(new Event("change", { bubbles: true }));

        // Step 5: Wait for dropdown to appear and pick best match using scoring
        let found = false;
        const searchLower = searchTerm.toLowerCase();

        // Wait up to 6 seconds, checking every 400ms
        for (let wait = 0; wait < 15 && !found; wait++) {
          await fillerLib.sleep(400);

          const candidates = [];

          // Strategy A: ARIA role=option
          for (const opt of document.querySelectorAll("[role='option']")) {
            if (opt.textContent.toLowerCase().includes(searchLower) && analyzer.isElementVisible(opt)) {
              candidates.push(opt);
            }
          }

          // Strategy B: New elements that appeared after typing
          for (const elem of document.querySelectorAll("div, li, span, button, a, p")) {
            if (preTypeSnapshot.has(elem)) continue;
            const text = (elem.textContent || "").trim();
            if (text.toLowerCase().includes(searchLower) &&
                text.length < 150 && text.length > 0 &&
                analyzer.isElementVisible(elem) && elem.offsetHeight < 100) {
              candidates.push(elem);
            }
          }

          // Strategy C: aria-controls listbox
          if (el.getAttribute("aria-expanded") === "true") {
            const controlsId = el.getAttribute("aria-controls");
            if (controlsId) {
              const listbox = document.getElementById(controlsId);
              if (listbox) {
                for (const item of listbox.querySelectorAll("[role='option'], li, div")) {
                  if (item.textContent.toLowerCase().includes(searchLower) && analyzer.isElementVisible(item)) {
                    candidates.push(item);
                  }
                }
              }
            }
          }

          // Strategy D: Portals and overlays
          for (const portal of document.querySelectorAll(
            "[class*='Portal'], [class*='portal'], [class*='Overlay'], [class*='overlay'], " +
            "[class*='Popover'], [class*='popover'], [class*='Menu'], [class*='Dropdown'], " +
            "[id*='popover'], [id*='menu'], [id*='dropdown']"
          )) {
            for (const item of portal.querySelectorAll("div, li, button, span")) {
              if (item.textContent.toLowerCase().includes(searchLower) &&
                  item.textContent.trim().length < 150 && analyzer.isElementVisible(item)) {
                candidates.push(item);
              }
            }
          }

          if (candidates.length > 0) {
            const best = pickBestMatch(candidates, searchTerm);
            if (best) {
              await fillerLib.clickElement(best);
              found = true;
              break;
            }
          }
        }

        // Step 6: If nothing worked, try Enter key as last resort
        if (!found) {
          el.focus();
          el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
          await fillerLib.sleep(100);
          el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
          await fillerLib.sleep(300);
        }

        // Step 7: Verify — check if a token appeared
        await fillerLib.sleep(300);
        const tokens = document.querySelectorAll('[data-test-id-v2="token"]');
        const tokenTexts = Array.from(tokens).map(t => t.textContent.toLowerCase());
        const tokenFound = tokenTexts.some(t => t.includes(searchLower));

        return `Select F${action.fieldIndex}: "${searchTerm}" ${found ? "CLICKED" : "NO DROPDOWN"} ${tokenFound ? "TOKEN OK" : "NO TOKEN"}`;
      }

      case "wait": {
        const ms = Math.min(parseInt(action.value) || 500, 3000);
        await fillerLib.sleep(ms);
        return `Wait ${ms}ms`;
      }

      case "done":
        return `Done: ${action.reason || ""}`;

      default:
        return `${action.type || "unknown"}: ${action.reason || ""}`;
    }
  }

  // ============================================================
  // Error Detection
  // ============================================================

  function scanForErrors() {
    const errors = [];
    const selectors = [
      "[class*='error']", "[class*='Error']",
      "[role='alert']", "[aria-live='assertive']",
      "[class*='warning']", "[class*='invalid']",
    ];

    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (!analyzer.isElementVisible(el)) continue;
        const text = (el.textContent || "").trim();
        if (text.length > 5 && text.length < 200 &&
            !text.includes("Learn more") &&
            !text.includes("migrating") &&
            !text.includes("intermittent") &&
            !text.includes("upgrade")) {
          errors.push(text);
        }
      }
    }
    return [...new Set(errors)];
  }

  // ============================================================
  // Helpers
  // ============================================================

  function finish(reason, pages, history) {
    log(`\n✓ DONE: ${reason} (${pages} pages)`);
    addStep(reason);
    flushLogs();
    showOverlayDone(reason, pages);
    chrome.runtime.sendMessage({
      type: "DEPLOY_COMPLETE", platform: "x", success: true,
      details: { pages, history },
    });
  }

  function withTimeout(promise, ms, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
    ]);
  }

  const BACKEND_TIMEOUT = 60000; // 60s — large pages need more time

  function log(msg) {
    const time = new Date().toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const line = `${time} ${msg}`;
    console.log(`[Kalit] ${msg}`);
    _logBuffer.push(line);

    // Append to debug log (hidden by default)
    const logEl = document.getElementById("kd-debug-log");
    if (logEl) {
      logEl.textContent += line + "\n";
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  /** Update the human-readable status line in the overlay */
  function status(msg) {
    const el = document.getElementById("kd-status");
    if (el) el.textContent = msg;
  }

  /** Add a completed step to the progress list */
  function addStep(text, success = true) {
    const list = document.getElementById("kd-steps");
    if (!list) return;
    const li = document.createElement("div");
    li.className = "kd-step";
    li.innerHTML = `<span class="kd-step-icon ${success ? "kd-step-ok" : "kd-step-warn"}">${success ? "&#10003;" : "!"}</span>${esc(text)}`;
    list.appendChild(li);
    list.scrollTop = list.scrollHeight;
  }

  /** Add a user message to the chat history */
  function addChat(text, isUser = false) {
    const list = document.getElementById("kd-steps");
    if (!list) return;
    const li = document.createElement("div");
    li.className = `kd-chat ${isUser ? "kd-chat-user" : "kd-chat-ai"}`;
    li.textContent = text;
    list.appendChild(li);
    list.scrollTop = list.scrollHeight;
  }

  function flushLogs() {
    chrome.storage.local.set({ deployLogs: { timestamp: new Date().toISOString(), platform: "x", lines: _logBuffer } });
    chrome.runtime.sendMessage({ type: "SAVE_LOGS", logs: { timestamp: new Date().toISOString(), platform: "x", lines: _logBuffer } });
  }

  // ============================================================
  // User Prompt — allows human corrections during deployment
  // ============================================================

  let _userPromptResolve = null; // resolve function for pending user message
  let _currentCampaign = null;
  let _currentPlatform = null;

  /** Check if there's a pending user message, process it if so */
  async function checkUserPrompt() {
    if (!_userPromptResolve) return;
    // There's a pending message — wait for it
    // (The promise was already created when the user clicked Send)
  }

  /** Process a user correction message */
  async function processUserMessage(message) {
    log(`USER: ${message}`);
    addChat(message, true);
    status("Processing your instruction...");

    const snapshot = analyzer.apiSnapshot();

    const result = await callBackend({
      snapshot,
      campaign: _currentCampaign,
      mode: "user_correction",
      platform: _currentPlatform,
      userMessage: message,
    });

    if (!result || result.error) {
      addChat("Sorry, couldn't process that. Try again.", false);
      status("Continuing deployment...");
      return;
    }

    if (result.feedback) {
      addChat(result.feedback, false);
    }

    const actions = result.actions || [];
    const executableActions = actions.filter(a => a.type !== "done");

    if (executableActions.length > 0) {
      status(`Applying ${executableActions.length} correction${executableActions.length > 1 ? "s" : ""}...`);
      for (const action of executableActions) {
        const desc = await execCommand(action);
        log(`  User fix: ${desc}`);
      }
      addStep("Applied corrections");
    } else {
      addChat("No changes needed.", false);
    }

    status("Continuing deployment...");
  }

  // ============================================================
  // Overlay UI — Kalit Design System
  // ============================================================

  function showOverlay(campaign) {
    _currentCampaign = campaign;
    if (overlayEl) overlayEl.remove();
    overlayEl = document.createElement("div");
    overlayEl.id = "kalit-deploy-overlay";
    overlayEl.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap');

        #kalit-deploy-overlay {
          position: fixed; top: 20px; right: 20px; width: 420px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.03), transparent 40%),
            linear-gradient(155deg, rgba(15,23,42,0.97), rgba(8,13,27,0.94));
          border: 1px solid rgba(148,163,184,0.14);
          color: #f8fafc;
          font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 14px; z-index: 999999;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.06),
            0 32px 90px rgba(2,6,23,0.6),
            0 0 0 1px rgba(0,0,0,0.3);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
        }
        #kalit-deploy-overlay * { box-sizing: border-box; margin: 0; padding: 0; }

        /* Header */
        .kd-hdr {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(148,163,184,0.1);
          display: flex; align-items: center; justify-content: space-between;
          background: linear-gradient(180deg, rgba(255,255,255,0.04), transparent);
        }
        .kd-hdr-left { display: flex; align-items: center; gap: 12px; }
        .kd-logo {
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid rgba(200,255,0,0.15);
          background: rgba(200,255,0,0.04);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 0 20px rgba(200,255,0,0.06);
        }
        .kd-logo svg { width: 18px; height: 18px; }
        .kd-hdr-text {}
        .kd-hdr-eyebrow {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px; font-weight: 500;
          text-transform: uppercase; letter-spacing: 0.28em;
          color: #64748b; margin-bottom: 2px;
        }
        .kd-hdr-title { font-size: 16px; font-weight: 700; color: #f8fafc; letter-spacing: -0.03em; }
        .kd-close {
          background: none; border: 1px solid rgba(148,163,184,0.1);
          color: #64748b; cursor: pointer; font-size: 16px; line-height: 1;
          width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .kd-close:hover { color: #f8fafc; border-color: rgba(148,163,184,0.25); background: rgba(255,255,255,0.04); }

        /* Body */
        .kd-body { padding: 16px 20px; }
        .kd-campaign {
          font-size: 12px; font-weight: 500; color: #c8ff00;
          margin-bottom: 14px;
          padding: 8px 12px;
          background: rgba(200,255,0,0.04);
          border: 1px solid rgba(200,255,0,0.08);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          font-family: 'IBM Plex Mono', monospace; letter-spacing: 0.01em;
        }

        /* Status */
        .kd-status-row {
          display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
          padding: 12px 14px;
          background: rgba(15,23,42,0.72);
          border: 1px solid rgba(148,163,184,0.1);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
        }
        .kd-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(200,255,0,0.15);
          border-top-color: #c8ff00;
          border-radius: 50%;
          animation: kd-spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        .kd-spinner-done {
          width: 18px; height: 18px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.25);
          color: #10b981; font-size: 12px; font-weight: 700;
        }
        @keyframes kd-spin { to { transform: rotate(360deg); } }
        .kd-status-text {
          font-size: 13px; color: #cbd5e1; line-height: 1.4;
        }

        /* Steps / Chat */
        .kd-steps {
          max-height: 240px; overflow-y: auto; margin-bottom: 14px;
          scrollbar-width: thin; scrollbar-color: rgba(148,163,184,0.1) transparent;
        }
        .kd-step {
          padding: 7px 0; font-size: 13px; color: #94a3b8;
          border-bottom: 1px solid rgba(148,163,184,0.06);
          display: flex; align-items: flex-start; gap: 8px;
        }
        .kd-step-icon {
          flex-shrink: 0; width: 18px; height: 18px;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700; margin-top: 1px;
        }
        .kd-step-ok {
          color: #10b981;
          background: rgba(16,185,129,0.08);
          border: 1px solid rgba(16,185,129,0.15);
        }
        .kd-step-warn {
          color: #f59e0b;
          background: rgba(245,158,11,0.08);
          border: 1px solid rgba(245,158,11,0.15);
        }

        /* Chat messages */
        .kd-chat {
          padding: 8px 12px; margin-bottom: 8px; font-size: 13px; line-height: 1.45;
          max-width: 88%;
        }
        .kd-chat-user {
          background: rgba(200,255,0,0.06); border: 1px solid rgba(200,255,0,0.12);
          color: #d4ff33; margin-left: auto;
        }
        .kd-chat-ai {
          background: rgba(15,23,42,0.72); border: 1px solid rgba(148,163,184,0.1);
          color: #94a3b8;
        }

        /* User input */
        .kd-input-row {
          display: flex; gap: 8px; margin-bottom: 12px;
        }
        .kd-input {
          flex: 1; padding: 10px 14px; font-size: 13px;
          font-family: 'Space Grotesk', sans-serif;
          background: rgba(15,23,42,0.72);
          border: 1px solid rgba(148,163,184,0.12);
          color: #f8fafc; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .kd-input::placeholder { color: #475569; font-size: 12px; }
        .kd-input:focus {
          border-color: rgba(200,255,0,0.3);
          box-shadow: 0 0 0 1px rgba(200,255,0,0.08);
        }
        .kd-send {
          padding: 10px 16px; font-size: 11px; font-weight: 600;
          font-family: 'IBM Plex Mono', monospace;
          text-transform: uppercase; letter-spacing: 0.08em;
          background: linear-gradient(135deg, #d9ff63 0%, #c8ff00 38%, #7dd3fc 100%);
          border: none; color: #0a0a0f; cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
          box-shadow: 0 4px 12px rgba(200,255,0,0.15);
        }
        .kd-send:hover { opacity: 0.92; transform: translateY(-1px); }
        .kd-send:active { transform: translateY(0); }
        .kd-send:disabled { opacity: 0.35; cursor: not-allowed; transform: none; box-shadow: none; }

        /* Footer */
        .kd-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding-top: 10px; border-top: 1px solid rgba(148,163,184,0.06);
        }
        .kd-toggle {
          background: none; border: 1px solid rgba(148,163,184,0.08);
          cursor: pointer; padding: 4px 10px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px; font-weight: 500;
          text-transform: uppercase; letter-spacing: 0.12em;
          color: #475569; transition: all 0.15s;
        }
        .kd-toggle:hover { color: #94a3b8; border-color: rgba(148,163,184,0.2); background: rgba(255,255,255,0.02); }
        .kd-version {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px; color: #334155; letter-spacing: 0.06em;
        }

        /* Pulse dot for live indicator */
        .kd-live {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px; font-weight: 500; color: #64748b;
          text-transform: uppercase; letter-spacing: 0.16em;
        }
        .kd-live-dot {
          position: relative; width: 6px; height: 6px;
        }
        .kd-live-dot::before {
          content: ''; position: absolute; inset: 0;
          background: #10b981; border-radius: 50%;
          animation: kd-pulse 2s ease-in-out infinite;
        }
        .kd-live-dot::after {
          content: ''; position: absolute; inset: 0;
          background: #10b981; border-radius: 50%;
        }
        @keyframes kd-pulse {
          0%, 100% { opacity: 0; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(2.5); }
        }

        /* Debug log */
        .kd-debug {
          font-size: 10px; color: #475569; max-height: 200px; overflow-y: auto;
          font-family: 'IBM Plex Mono', monospace; line-height: 1.6;
          background: rgba(0,0,0,0.3); padding: 10px;
          border: 1px solid rgba(148,163,184,0.06);
          display: none; margin-top: 10px;
          scrollbar-width: thin; scrollbar-color: rgba(148,163,184,0.1) transparent;
        }

        /* Done button */
        .kd-done-btn {
          width: 100%; padding: 12px; margin-top: 12px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 13px; font-weight: 600;
          border: 1px solid rgba(148,163,184,0.12);
          background: rgba(15,23,42,0.72); color: #94a3b8;
          cursor: pointer; transition: all 0.15s;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
        }
        .kd-done-btn:hover {
          border-color: rgba(200,255,0,0.2); color: #c8ff00;
          background: rgba(200,255,0,0.04);
        }
      </style>
      <div class="kd-hdr">
        <div class="kd-hdr-left">
          <div class="kd-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="#c8ff00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
          <div class="kd-hdr-text">
            <div class="kd-hdr-eyebrow">Deploy Agent</div>
            <div class="kd-hdr-title">Kalit</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="kd-live"><span class="kd-live-dot"></span> Live</div>
          <button class="kd-close" id="kd-close">&times;</button>
        </div>
      </div>
      <div class="kd-body">
        <div class="kd-campaign">${esc(campaign.name || "Campaign")}</div>
        <div class="kd-status-row" id="kd-status-row">
          <div class="kd-spinner" id="kd-spinner"></div>
          <div class="kd-status-text" id="kd-status">Starting deployment...</div>
        </div>
        <div class="kd-steps" id="kd-steps"></div>
        <div class="kd-input-row">
          <input class="kd-input" id="kd-user-input" type="text" placeholder="Type a correction or instruction..." />
          <button class="kd-send" id="kd-send">Send</button>
        </div>
        <div class="kd-footer">
          <button class="kd-toggle" id="kd-toggle-debug">Debug</button>
          <span class="kd-version">${BUILD_VERSION}</span>
        </div>
        <div class="kd-debug" id="kd-debug-log"></div>
      </div>
    `;
    document.body.appendChild(overlayEl);

    // Close button
    document.getElementById("kd-close").addEventListener("click", () => overlayEl.remove());

    // Debug toggle
    document.getElementById("kd-toggle-debug").addEventListener("click", () => {
      const dbg = document.getElementById("kd-debug-log");
      const btn = document.getElementById("kd-toggle-debug");
      if (dbg.style.display === "none") {
        dbg.style.display = "block";
        btn.textContent = "Hide debug";
      } else {
        dbg.style.display = "none";
        btn.textContent = "Debug";
      }
    });

    // User prompt — send button + enter key
    const sendBtn = document.getElementById("kd-send");
    const inputEl = document.getElementById("kd-user-input");

    async function handleSend() {
      const msg = inputEl.value.trim();
      if (!msg) return;
      inputEl.value = "";
      sendBtn.disabled = true;
      await processUserMessage(msg);
      sendBtn.disabled = false;
      inputEl.focus();
    }

    sendBtn.addEventListener("click", handleSend);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      // Stop propagation so X Ads doesn't capture keystrokes
      e.stopPropagation();
    });
    // Stop all keyboard events from reaching X Ads when input is focused
    inputEl.addEventListener("keyup", (e) => e.stopPropagation());
    inputEl.addEventListener("keypress", (e) => e.stopPropagation());
  }

  function showOverlayDone(reason, pages) {
    // Replace spinner with checkmark
    const spinner = document.getElementById("kd-spinner");
    if (spinner) {
      spinner.outerHTML = '<div class="kd-spinner-done">&#10003;</div>';
    }

    // Update status
    const statusEl = document.getElementById("kd-status");
    if (statusEl) {
      statusEl.textContent = reason;
      statusEl.style.color = "#10b981";
    }

    // Update status row
    const row = document.getElementById("kd-status-row");
    if (row) {
      row.style.borderColor = "rgba(16,185,129,0.15)";
      row.style.background = "rgba(16,185,129,0.04)";
    }

    // Add done button
    const body = overlayEl?.querySelector(".kd-body");
    if (body) {
      const btn = document.createElement("button");
      btn.className = "kd-done-btn";
      btn.textContent = "Close";
      btn.addEventListener("click", () => overlayEl.remove());
      body.appendChild(btn);
    }
  }

  function esc(s) { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }

  // ============================================================
  // Sync
  // ============================================================

  async function handleSync(syncRequest) {
    if (!scraper) return;
    // (sync UI unchanged — abbreviated here)
    const data = scraper.scrape();
    chrome.runtime.sendMessage({
      type: "SYNC_DATA",
      syncData: { ...data, workspaceId: syncRequest.workspaceId },
      apiEndpoint: syncRequest.apiEndpoint,
    });
  }
})();
