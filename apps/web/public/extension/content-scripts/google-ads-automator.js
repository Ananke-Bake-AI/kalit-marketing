/**
 * Google Ads Automator — AI-Driven, Section-by-Section fill
 *
 * Google Ads is a single-page Angular app. All sections (campaign name,
 * budget, ad group, ads) are accordion panels in one page.
 * No page navigation — just expand sections and fill fields.
 *
 * Flow:
 *   1. Select campaign objective + type (Page B)
 *   2. Fill campaign settings (accordion sections)
 *   3. Fill ad group (name, locations, languages)
 *   4. Fill ad (name, URL, headlines, descriptions)
 *   5. Click "Publish campaign"
 */

(() => {
  const analyzer = window.__kalitDomAnalyzer;
  const fillerLib = window.__kalitFormFiller;

  if (!analyzer || !fillerLib) {
    console.error("[Kalit Google Automator] Missing dependencies");
    return;
  }

  const BUILD_VERSION = "google-v1";
  console.log(`[Kalit Google Automator] ${BUILD_VERSION} loaded on`, window.location.href);

  // Check for deployment
  chrome.runtime.sendMessage({ type: "AUTOMATOR_READY" }, async (response) => {
    if (!response || response.status !== "ok" || !response.deployment) {
      console.log("[Kalit Google Automator] No pending deployment");
      return;
    }

    const { campaign, platform } = response.deployment;
    if (platform !== "google") {
      console.log("[Kalit Google Automator] Not a Google campaign, skipping");
      return;
    }

    console.log(`[Kalit Google Automator] Deploying: ${campaign.name}`);
    await fillerLib.sleep(3000);
    await runGoogleAdsFill(campaign);
  });

  // ============================================================
  // Main Fill Flow
  // ============================================================

  async function runGoogleAdsFill(campaign) {
    const log = (msg) => console.log(`[Kalit Google] ${msg}`);

    // Ensure tab is focused
    chrome.runtime.sendMessage({ type: "FOCUS_TAB" });
    window.focus();

    // Get the first ad group with google platform
    const adGroup = campaign.adGroups?.find(ag =>
      ag.platform === "google" || !ag.platform
    ) || campaign.adGroups?.[0];

    if (!adGroup) {
      log("No ad group found for Google");
      return;
    }

    const creative = adGroup.creatives?.[0] || {};
    const targeting = adGroup.targeting || {};

    // Detect which page we're on
    const url = window.location.href;

    if (url.includes("/campaigns/new") || url.includes("/campaigns/add")) {
      // Page B: Goal + Type selection
      log("Page B: Selecting campaign objective and type...");
      await selectObjectiveAndType(campaign);
    } else if (url.includes("/campaigns/edit") || url.includes("/campaign_form")) {
      // Page C: Campaign editor (main form)
      log("Page C: Filling campaign form...");
      await fillCampaignForm(campaign, adGroup, creative, targeting);
    } else {
      // Overview page — need to click "Create" first
      log("Overview page — clicking Create > Campaign...");
      await startNewCampaign();
    }
  }

  // ============================================================
  // Page B: Objective + Type Selection
  // ============================================================

  async function selectObjectiveAndType(campaign) {
    const log = (msg) => console.log(`[Kalit Google] ${msg}`);

    // Select objective — default to "Website traffic"
    const objective = campaign.objective || "conversions";
    const objectiveMap = {
      conversions: "WEBSITE_TRAFFIC",
      traffic: "WEBSITE_TRAFFIC",
      sales: "SALES",
      leads: "LEADS",
      awareness: "AWARENESS_AND_CONSIDERATION",
    };
    const objectiveValue = objectiveMap[objective] || "WEBSITE_TRAFFIC";

    const objTab = document.querySelector(`dynamic-component[role="tab"][data-value="${objectiveValue}"]`) ||
                   document.querySelector(`[role="tab"][data-value="${objectiveValue}"]`);
    if (objTab) {
      await fillerLib.clickElement(objTab);
      log(`Selected objective: ${objectiveValue}`);
      await fillerLib.sleep(500);
    }

    // Select campaign type — Demand Gen for social-style ads, Search for text ads
    await fillerLib.sleep(1000);
    const campaignType = campaign.type === "paid_search" ? "Search" : "Demand Gen";
    const typeCard = document.querySelector(`selection-card[aria-label="${campaignType}"]`) ||
                     document.querySelector(`[aria-label="${campaignType}"]`);
    if (typeCard) {
      await fillerLib.clickElement(typeCard);
      log(`Selected type: ${campaignType}`);
      await fillerLib.sleep(500);
    }

    // Click "Continue" / "Agree and continue"
    await fillerLib.sleep(1000);
    const continueBtn = document.querySelector('button[aria-label="Agree and continue to the next step"]') ||
                        document.querySelector('button[aria-label="Continue"]') ||
                        findButtonByText("Continue");
    if (continueBtn) {
      await fillerLib.clickElement(continueBtn);
      log("Clicked Continue");
      await fillerLib.sleep(3000); // Wait for editor to load
    }

    // Now we should be on the editor page — fill it
    log("Editor loaded, starting form fill...");
    // Re-check — the page may have reloaded
    await fillerLib.sleep(2000);
  }

  // ============================================================
  // Page C: Campaign Editor (Single Page with Accordions)
  // ============================================================

  async function fillCampaignForm(campaign, adGroup, creative, targeting) {
    const log = (msg) => console.log(`[Kalit Google] ${msg}`);

    // 1. Campaign Name
    log("Filling campaign name...");
    await expandAccordion("Campaign name");
    await fillByAriaLabel("Campaign name", campaign.name);
    await fillerLib.sleep(300);

    // 2. Budget
    log("Filling budget...");
    await expandAccordion("Budget and dates");
    const budgetAmount = campaign.dailyBudget || adGroup.dailyBudget || 50;
    await fillByAriaLabel("Budget amount in $", String(budgetAmount));
    await fillerLib.sleep(300);

    // 3. Ad Group Name
    log("Filling ad group...");
    await fillByAriaLabel("Ad group name", adGroup.name);
    await fillerLib.sleep(300);

    // 4. Locations
    if (targeting.locations?.length > 0) {
      log(`Adding ${targeting.locations.length} locations...`);
      // First, check if "Enter another location" radio needs to be selected
      const enterLocationRadio = document.querySelector('input[type="radio"][value="enter"]') ||
                                  findElementByText("Enter another location");
      if (enterLocationRadio) {
        await fillerLib.clickElement(enterLocationRadio);
        await fillerLib.sleep(500);
      }

      const locationInput = document.querySelector('input[role="combobox"][aria-haspopup="true"][aria-autocomplete="list"]') ||
                            document.querySelector('input[aria-label*="location"]');

      if (locationInput) {
        for (const location of targeting.locations) {
          await typeAndSelect(locationInput, location);
          await fillerLib.sleep(500);
        }
      }
    }

    // 5. Languages
    if (targeting.languages?.length > 0) {
      log(`Setting languages: ${targeting.languages.join(", ")}`);
      const langInput = document.querySelector('input[aria-label="Start typing or select a language"]');
      if (langInput) {
        for (const lang of targeting.languages) {
          await typeAndSelect(langInput, lang);
          await fillerLib.sleep(300);
        }
      }
    }

    // 6. Ad — Type selection (Single image ad)
    log("Filling ad...");
    const singleImageRadio = document.querySelector('input[type="radio"]');
    // Default is usually "Single image ad" — leave it

    // 7. Ad Name
    await fillByAriaLabel("Ad name", creative.headline || `${campaign.name} - Ad 1`);
    await fillerLib.sleep(300);

    // 8. Final URL
    log("Setting Final URL...");
    const urlInput = document.querySelector('url-input[debugid="final-url"] input') ||
                     document.querySelector('input[aria-label*="Final URL"]');
    if (urlInput) {
      await fillInput(urlInput, creative.destinationUrl || campaign.websiteUrl || "https://kalit.ai");
      await fillerLib.sleep(500);
    }

    // 9. Headlines
    if (creative.headline || creative.headlines?.length > 0) {
      log("Adding headlines...");
      const headlines = creative.headlines?.length > 0
        ? creative.headlines
        : [creative.headline];

      // Fill first headline
      const headlineInput = document.querySelector('input[aria-label="Headline"]');
      if (headlineInput && headlines[0]) {
        await fillInput(headlineInput, headlines[0]);
        await fillerLib.sleep(300);
      }

      // Add more headlines if available (click "+" button)
      for (let i = 1; i < Math.min(headlines.length, 5); i++) {
        const addBtn = findButtonByText("Add headline") || findButtonByText("Add");
        if (addBtn) {
          await fillerLib.clickElement(addBtn);
          await fillerLib.sleep(300);
          // Find the new empty headline input
          const allHeadlines = document.querySelectorAll('input[aria-label="Headline"]');
          const emptyOne = Array.from(allHeadlines).find(el => !el.value);
          if (emptyOne) {
            await fillInput(emptyOne, headlines[i]);
            await fillerLib.sleep(200);
          }
        }
      }
    }

    // 10. Descriptions
    if (creative.body || creative.descriptions?.length > 0) {
      log("Adding descriptions...");
      const descriptions = creative.descriptions?.length > 0
        ? creative.descriptions
        : [creative.body];

      const descInput = document.querySelector('input[aria-label="Description"]');
      if (descInput && descriptions[0]) {
        await fillInput(descInput, descriptions[0]);
        await fillerLib.sleep(300);
      }
    }

    // 11. Business Name
    const bizNameInput = document.querySelector('input[aria-label="Business name"]');
    if (bizNameInput) {
      const bizName = campaign.businessName || campaign.name?.split("—")[0]?.trim() || "Kalit";
      await fillInput(bizNameInput, bizName);
      await fillerLib.sleep(300);
    }

    log("Form fill complete! Review and click Publish.");

    // Send completion signal
    chrome.runtime.sendMessage({
      type: "DEPLOY_COMPLETE",
      platform: "google",
      success: true,
      details: { message: "Google Ads form filled — review and publish" },
    });
  }

  // ============================================================
  // Start New Campaign (from overview page)
  // ============================================================

  async function startNewCampaign() {
    // Click the blue "+" FAB button
    const fab = document.querySelector('material-fab[aria-label="Create"]') ||
                document.querySelector('[aria-label="Create"]');
    if (fab) {
      await fillerLib.clickElement(fab);
      await fillerLib.sleep(500);

      // Click "Campaign" in the popup menu
      const campaignOption = findButtonByText("Campaign") ||
                              document.querySelector('[aria-label="Campaign"]');
      if (campaignOption) {
        await fillerLib.clickElement(campaignOption);
        await fillerLib.sleep(2000);
      }
    }
  }

  // ============================================================
  // Helpers
  // ============================================================

  /** Expand an accordion section by its aria-label */
  async function expandAccordion(sectionName) {
    const header = document.querySelector(`div.header[aria-label="${sectionName}"]`) ||
                   document.querySelector(`[aria-label="${sectionName}"][role="button"]`) ||
                   findElementByText(sectionName);
    if (!header) return;

    const expanded = header.getAttribute("aria-expanded");
    if (expanded === "false") {
      await fillerLib.clickElement(header);
      await fillerLib.sleep(500);
    }
  }

  /** Fill an input found by aria-label */
  async function fillByAriaLabel(label, value) {
    if (!value) return;
    const input = document.querySelector(`input[aria-label="${label}"]`) ||
                  document.querySelector(`input[aria-label="${label}"][aria-required="true"]`);
    if (input) {
      await fillInput(input, value);
    }
  }

  /** Fill an input with React/Angular-compatible events */
  async function fillInput(element, value) {
    if (!element || !value) return;

    element.focus();
    await fillerLib.sleep(50);

    // Clear existing value
    element.value = "";
    element.dispatchEvent(new Event("input", { bubbles: true }));
    await fillerLib.sleep(50);

    // Set value via native setter (Angular compatibility)
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (nativeSetter) nativeSetter.call(element, value);
    else element.value = value;

    // Dispatch events Angular listens to
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
    await fillerLib.sleep(100);
  }

  /** Type into a combobox and select from the dropdown */
  async function typeAndSelect(input, searchText) {
    input.focus();
    await fillerLib.sleep(100);

    // Clear
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (nativeSetter) nativeSetter.call(input, "");
    else input.value = "";
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
    await fillerLib.sleep(200);

    // Type character by character
    for (let i = 0; i < searchText.length; i++) {
      const ch = searchText[i];
      const partial = searchText.slice(0, i + 1);

      input.dispatchEvent(new KeyboardEvent("keydown", { key: ch, code: `Key${ch.toUpperCase()}`, bubbles: true }));
      if (nativeSetter) nativeSetter.call(input, partial);
      else input.value = partial;
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: ch }));
      input.dispatchEvent(new KeyboardEvent("keyup", { key: ch, code: `Key${ch.toUpperCase()}`, bubbles: true }));
      await fillerLib.sleep(40);
    }

    // Wait for dropdown
    const searchLower = searchText.toLowerCase();
    let found = false;

    for (let wait = 0; wait < 15 && !found; wait++) {
      await fillerLib.sleep(400);

      // Look for options in listbox
      for (const opt of document.querySelectorAll('[role="option"], [role="listbox"] li, mat-option')) {
        if (opt.textContent.toLowerCase().includes(searchLower) && analyzer.isElementVisible(opt)) {
          await fillerLib.clickElement(opt);
          found = true;
          break;
        }
      }
    }

    if (!found) {
      // Press Enter as fallback
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
      await fillerLib.sleep(200);
    }

    console.log(`[Kalit Google] select: "${searchText}" → ${found ? "CLICKED" : "ENTER"}`);
  }

  /** Find a visible button by its text content */
  function findButtonByText(text) {
    const lower = text.toLowerCase();
    for (const btn of document.querySelectorAll("button, [role='button'], material-button")) {
      if (btn.textContent.trim().toLowerCase().includes(lower) && analyzer.isElementVisible(btn)) {
        return btn;
      }
    }
    return null;
  }

  /** Find any visible element by text content */
  function findElementByText(text) {
    const lower = text.toLowerCase();
    for (const el of document.querySelectorAll("div, span, label, legend, h2, h3")) {
      const elText = el.textContent.trim().toLowerCase();
      if (elText === lower && analyzer.isElementVisible(el)) {
        return el;
      }
    }
    return null;
  }
})();
