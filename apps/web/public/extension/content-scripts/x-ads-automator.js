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

  const BUILD_VERSION = "v6-js-execution";
  console.log(`[Kalit Automator] ${BUILD_VERSION} loaded on`, window.location.href);

  const MAX_PAGES = 10;
  const MAX_VERIFY_RETRIES = 2;
  let overlayEl = null;

  // Persistent log buffer
  const _logBuffer = [];

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
    log(`Deploy: ${campaign.name} on ${platform}`);
    await fillerLib.sleep(2500);
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
        break;
      }

      const allActions = planResult.actions || [];
      const fillActions = allActions.filter(a => a.type !== "done" && a.type !== "click");
      const isDone = allActions.some(a => a.type === "done");

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

      await fillerLib.sleep(500);

      // ── VERIFY ──
      let verified = false;
      for (let attempt = 0; attempt <= MAX_VERIFY_RETRIES; attempt++) {
        log(attempt === 0 ? "VERIFY: Checking page..." : `VERIFY: Retry ${attempt}...`);

        await fillerLib.sleep(400);
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
          break;
        }

        // Check what AI returned
        const hasFixes = verifyResult.actions.some(a => a.type === "fill" || a.type === "select");
        const hasNav = verifyResult.actions.some(a => a.type === "click");
        const hasDone = verifyResult.actions.some(a => a.type === "done");

        if (hasFixes) {
          // AI found issues — apply fixes
          log(`VERIFY: ${verifyResult.actions.filter(a => a.type === "fill" || a.type === "select").length} fixes needed`);
          for (const action of verifyResult.actions) {
            if (action.type === "fill" || action.type === "select") {
              const desc = await execAction(action);
              log(`  Fix: ${desc}`);
            }
          }
          await fillerLib.sleep(500);
          // Loop to re-verify
          continue;
        }

        if (hasNav || hasDone) {
          // Page is correct — navigate
          log("VERIFY: Page OK");

          // Find and click the navigation button
          const navAction = verifyResult.actions.find(a => a.type === "click");
          if (navAction) {
            const desc = await execAction(navAction);
            log(`NAV: ${desc}`);
          }

          verified = true;

          // Check if this was the final page
          if (hasDone && !hasNav) {
            finish("Campaign saved", pageCount, history);
            return;
          }

          break;
        }

        // Unexpected response — break verify loop
        log("VERIFY: Unclear response, moving on");
        break;
      }

      if (!verified) {
        // Could not verify — try to click Next anyway
        log("VERIFY: Failed, attempting Next...");
        const snap = analyzer.apiSnapshot();
        const nextBtn = snap.buttons.find(b =>
          b.text.toLowerCase().includes("next") || b.text.toLowerCase().includes("continue")
        );
        if (nextBtn) {
          const el = analyzer.getButtonByIndex(nextBtn.index);
          if (el) {
            await fillerLib.clickElement(el);
            log(`NAV: Clicked B${nextBtn.index} (${nextBtn.text})`);
          }
        }
      }

      // Record history
      history.push({
        step: pageCount,
        actions: _logBuffer.slice(-20).filter(l => l.includes("Fill") || l.includes("Select") || l.includes("Click")),
      });

      // Wait for page transition
      await fillerLib.sleep(1200);

      // Check if page actually changed
      const newUrl = window.location.pathname;
      const prevUrl = planSnapshot.url.replace(/https?:\/\/[^/]+/, "").split("?")[0];
      if (newUrl === prevUrl) {
        log("Page didn't change — might be an error or the form needs more input");
      }

      flushLogs();
    }

    if (pageCount >= MAX_PAGES) {
      log(`Hit page limit (${MAX_PAGES})`);
    }

    flushLogs();
    showOverlayDone("Stopped — review and complete manually", pageCount, history);
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
    const selector = action.selector || action.reason; // selector comes in 'selector' or 'reason' field

    // Selector-based commands (from new command format)
    if (selector && action.type === "fill") {
      const el = findElement(selector);
      if (!el) return `FILL "${selector}": NOT FOUND`;
      await helpers.fill(selector, action.value || "");
      return `FILL "${selector}" = "${(action.value || "").slice(0, 60)}"`;
    }

    if (selector && action.type === "select") {
      await helpers.selectFromDropdown(selector, action.value || "");
      return `SELECT "${action.value}" in "${selector}"`;
    }

    if (selector && action.type === "click") {
      const el = findElement(selector);
      if (!el) return `CLICK "${selector}": NOT FOUND`;
      await helpers.click(selector);
      return `CLICK "${selector}"`;
    }

    // Fall back to legacy index-based execution
    return await execAction(action);
  }

  // Helper: type into search field, wait for dropdown, click matching result
  async function selectFromDropdown(inputSelector, searchText) {
    const el = findElement(inputSelector);
    if (!el) { log(`  select: "${inputSelector}" NOT FOUND`); return false; }

    // Click to focus
    await fillerLib.clickElement(el);
    await fillerLib.sleep(200);

    // Clear existing text
    try {
      el.focus();
      if (el.value !== undefined) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        if (setter) setter.call(el, "");
        else el.value = "";
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (e) { /* ignore */ }
    await fillerLib.sleep(100);

    // Snapshot before typing to detect new dropdown elements
    const preType = new Set();
    document.querySelectorAll("*").forEach(e => preType.add(e));

    // Type search term
    await fillerLib.fillField(el, searchText);

    // Wait for dropdown and click matching result
    const searchLower = searchText.toLowerCase();
    let found = false;

    for (let wait = 0; wait < 10 && !found; wait++) {
      await fillerLib.sleep(300);

      // Strategy 1: ARIA role=option
      for (const opt of document.querySelectorAll("[role='option']")) {
        if (opt.textContent.toLowerCase().includes(searchLower) && analyzer.isElementVisible(opt)) {
          await fillerLib.clickElement(opt);
          found = true;
          break;
        }
      }
      if (found) break;

      // Strategy 2: aria-controls listbox
      if (el.getAttribute("aria-expanded") === "true") {
        const ctrlId = el.getAttribute("aria-controls");
        if (ctrlId) {
          const lb = document.getElementById(ctrlId);
          if (lb) {
            for (const item of lb.querySelectorAll("[role='option'], li, div")) {
              if (item.textContent.toLowerCase().includes(searchLower) && analyzer.isElementVisible(item)) {
                await fillerLib.clickElement(item);
                found = true;
                break;
              }
            }
          }
        }
      }
      if (found) break;

      // Strategy 3: New elements that appeared after typing
      for (const elem of document.querySelectorAll("div, li, span, button")) {
        if (preType.has(elem)) continue;
        const t = elem.textContent?.trim() || "";
        if (t.toLowerCase().includes(searchLower) && t.length > 0 && t.length < 150 &&
            analyzer.isElementVisible(elem) && elem.offsetHeight < 100) {
          await fillerLib.clickElement(elem);
          found = true;
          break;
        }
      }
      if (found) break;

      // Strategy 4: Portals and overlays
      for (const portal of document.querySelectorAll("[class*='Portal'], [class*='Popover'], [class*='Menu'], [class*='Overlay']")) {
        for (const item of portal.querySelectorAll("div, li, button")) {
          if (item.textContent.toLowerCase().includes(searchLower) &&
              item.textContent.trim().length < 150 && analyzer.isElementVisible(item)) {
            await fillerLib.clickElement(item);
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }

    // Last resort: press Enter
    if (!found) {
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
      await fillerLib.sleep(100);
      el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
      await fillerLib.sleep(200);
    }

    // Verify token appeared
    await fillerLib.sleep(200);
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
   */
  function findElement(selector) {
    // Try data-test-id-v2 first
    let el = document.querySelector(`[data-test-id-v2="${selector}"]`);
    if (el) return el;

    // Try data-test-id
    el = document.querySelector(`[data-test-id="${selector}"]`);
    if (el) return el;

    // Try data-testid
    el = document.querySelector(`[data-testid="${selector}"]`);
    if (el) return el;

    // Try as CSS selector directly
    try {
      el = document.querySelector(selector);
      if (el) return el;
    } catch { /* invalid selector */ }

    // Try by id
    el = document.getElementById(selector);
    if (el) return el;

    return null;
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

        // Step 1: Click the input to focus it
        await fillerLib.clickElement(el);
        await fillerLib.sleep(200);

        // Step 2: Clear existing text
        try {
          el.focus();
          // Select all + delete
          el.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA", ctrlKey: true, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", code: "Backspace", bubbles: true }));
          if (el.value !== undefined) {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
            if (setter) setter.call(el, "");
            else el.value = "";
          }
          el.dispatchEvent(new Event("input", { bubbles: true }));
        } catch (e) { /* ignore */ }
        await fillerLib.sleep(100);

        // Step 3: Record what's on the page before typing (to detect new dropdown elements)
        const preTypeSnapshot = new Set();
        document.querySelectorAll("*").forEach(e => preTypeSnapshot.add(e));

        // Step 4: Type the search term character by character (triggers autocomplete)
        await fillerLib.fillField(el, searchTerm);

        // Step 5: Wait for dropdown to appear — use a mutation observer instead of fixed sleep
        let found = false;
        const searchLower = searchTerm.toLowerCase();

        // Wait up to 3 seconds for suggestions, checking every 300ms
        for (let wait = 0; wait < 10 && !found; wait++) {
          await fillerLib.sleep(300);

          // Strategy A: Look for elements with role=option (proper ARIA dropdowns)
          const options = document.querySelectorAll("[role='option']");
          for (const opt of options) {
            if (opt.textContent.toLowerCase().includes(searchLower) && analyzer.isElementVisible(opt)) {
              await fillerLib.clickElement(opt);
              found = true;
              break;
            }
          }
          if (found) break;

          // Strategy B: Look for any NEW elements that appeared after typing and contain the search text
          const allNow = document.querySelectorAll("div, li, span, button, a, p");
          for (const elem of allNow) {
            if (preTypeSnapshot.has(elem)) continue; // existed before typing
            const text = (elem.textContent || "").trim();
            const lower = text.toLowerCase();
            // Must contain search term, be visible, be reasonably sized (not a huge container)
            if (lower.includes(searchLower) &&
                text.length < 150 &&
                text.length > 0 &&
                analyzer.isElementVisible(elem) &&
                elem.offsetHeight < 100) { // Not a huge container
              await fillerLib.clickElement(elem);
              found = true;
              break;
            }
          }
          if (found) break;

          // Strategy C: Check if the input now has aria-expanded="true" and follow aria-controls
          if (el.getAttribute("aria-expanded") === "true") {
            const controlsId = el.getAttribute("aria-controls");
            if (controlsId) {
              const listbox = document.getElementById(controlsId);
              if (listbox) {
                const items = listbox.querySelectorAll("[role='option'], li, div");
                for (const item of items) {
                  if (item.textContent.toLowerCase().includes(searchLower) && analyzer.isElementVisible(item)) {
                    await fillerLib.clickElement(item);
                    found = true;
                    break;
                  }
                }
              }
            }
          }
          if (found) break;

          // Strategy D: Look in common portal/overlay containers
          const portals = document.querySelectorAll(
            "[class*='Portal'], [class*='portal'], [class*='Overlay'], [class*='overlay'], " +
            "[class*='Popover'], [class*='popover'], [class*='Menu'], [class*='Dropdown'], " +
            "[id*='popover'], [id*='menu'], [id*='dropdown']"
          );
          for (const portal of portals) {
            const items = portal.querySelectorAll("div, li, button, span");
            for (const item of items) {
              if (item.textContent.toLowerCase().includes(searchLower) &&
                  item.textContent.trim().length < 150 &&
                  analyzer.isElementVisible(item)) {
                await fillerLib.clickElement(item);
                found = true;
                break;
              }
            }
            if (found) break;
          }
        }

        // Step 6: If nothing worked, try Enter key as last resort
        if (!found) {
          try {
            el.focus();
            el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
            await fillerLib.sleep(100);
            el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
            await fillerLib.sleep(300);
          } catch (e) { /* ignore */ }
        }

        // Step 7: Verify — check if a token appeared (data-test-id-v2="token")
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
    flushLogs();
    showOverlayDone(reason, pages, history);
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

    const logEl = document.getElementById("kd-log");
    if (logEl) {
      logEl.textContent += line + "\n";
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  function flushLogs() {
    chrome.storage.local.set({ deployLogs: { timestamp: new Date().toISOString(), platform: "x", lines: _logBuffer } });
    chrome.runtime.sendMessage({ type: "SAVE_LOGS", logs: { timestamp: new Date().toISOString(), platform: "x", lines: _logBuffer } });
  }

  // ============================================================
  // Overlay UI
  // ============================================================

  function showOverlay(campaign) {
    if (overlayEl) overlayEl.remove();
    overlayEl = document.createElement("div");
    overlayEl.id = "kalit-deploy-overlay";
    overlayEl.innerHTML = `
      <style>
        #kalit-deploy-overlay {
          position: fixed; top: 16px; right: 16px; width: 380px;
          background: #0a0a0f; border: 1px solid rgba(200,255,0,0.3);
          color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 13px; z-index: 999999;
          box-shadow: 0 20px 60px rgba(0,0,0,0.8);
        }
        #kalit-deploy-overlay * { box-sizing: border-box; margin: 0; padding: 0; }
        .kd-hdr {
          background: rgba(200,255,0,0.08); padding: 12px 16px;
          border-bottom: 1px solid rgba(200,255,0,0.2);
          display: flex; align-items: center; justify-content: space-between;
        }
        .kd-hdr h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #c8ff00; }
        .kd-close { background:none; border:none; color:#64748b; cursor:pointer; font-size:18px; }
        .kd-body { padding: 16px; }
        .kd-name { font-size: 14px; font-weight: 600; color: #fff; margin-bottom: 12px; }
        .kd-log {
          font-size: 10px; color: #94a3b8; max-height: 300px; overflow-y: auto;
          font-family: 'SF Mono', Monaco, monospace; line-height: 1.6;
          background: rgba(0,0,0,0.3); padding: 8px; border: 1px solid rgba(255,255,255,0.05);
        }
      </style>
      <div class="kd-hdr">
        <h3>Kalit AI Deploy</h3>
        <button class="kd-close" id="kd-close">&times;</button>
      </div>
      <div class="kd-body">
        <div class="kd-name">${esc(campaign.name || "Campaign")}</div>
        <div class="kd-log" id="kd-log"></div>
      </div>
    `;
    document.body.appendChild(overlayEl);
    document.getElementById("kd-close").addEventListener("click", () => overlayEl.remove());
  }

  function showOverlayDone(reason, pages, history) {
    const logEl = document.getElementById("kd-log");
    if (logEl) {
      logEl.style.borderColor = "rgba(16,185,129,0.3)";
    }
    const body = overlayEl?.querySelector(".kd-body");
    if (body) {
      const doneEl = document.createElement("div");
      doneEl.style.cssText = "margin-top:12px; padding:8px 12px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.2); color:#10b981; font-size:12px;";
      doneEl.innerHTML = `<strong>${esc(reason)}</strong><br><span style="font-size:10px;color:#64748b;">${pages} pages processed</span>`;
      body.appendChild(doneEl);

      const btn = document.createElement("button");
      btn.textContent = "Done";
      btn.style.cssText = "margin-top:8px; width:100%; padding:8px; font-size:12px; font-weight:600; border:none; background:rgba(255,255,255,0.05); color:#94a3b8; cursor:pointer;";
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
