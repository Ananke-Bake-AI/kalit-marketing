/**
 * DOM Analyzer — Adaptive Form Field Discovery
 *
 * Instead of hardcoded selectors, this module analyzes the page
 * semantically to find form fields by their labels, aria attributes,
 * placeholders, and surrounding context. This makes it resilient to
 * UI changes by the ad platform.
 *
 * Strategy:
 * 1. Find all interactive elements (input, textarea, select, [role=...])
 * 2. For each, extract semantic context (labels, aria, placeholder, nearby text)
 * 3. Build a semantic map: { fieldPurpose → element }
 * 4. Return a structured FormMap that the field-mapper can use
 */

const DomAnalyzer = (() => {
  /**
   * Extract all semantic context for a given form element.
   */
  function getFieldContext(el) {
    const context = {
      element: el,
      tagName: el.tagName.toLowerCase(),
      type: el.getAttribute("type") || "",
      name: el.getAttribute("name") || "",
      id: el.id || "",
      placeholder: el.getAttribute("placeholder") || "",
      ariaLabel: el.getAttribute("aria-label") || "",
      ariaLabelledBy: "",
      dataTestId: el.getAttribute("data-testid") || "",
      dataAutomationId: el.getAttribute("data-automation-id") || "",
      role: el.getAttribute("role") || "",
      nearbyText: [],
      labelText: "",
      parentText: "",
      sectionHeading: "",
      isVisible: isElementVisible(el),
      isDisabled: el.disabled || el.getAttribute("aria-disabled") === "true",
    };

    // Get aria-labelledby text
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl) context.ariaLabelledBy = labelEl.textContent.trim();
    }

    // Get associated <label> text
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) context.labelText = label.textContent.trim();
    }

    // Walk up to find label in parent + section heading
    let parent = el.parentElement;
    let depth = 0;
    while (parent && depth < 8) {
      // Check for labels
      if (!context.labelText) {
        const label = parent.querySelector("label");
        if (label) context.labelText = label.textContent.trim();
      }

      // Check for section headings (h1-h6, strong, bold text, section titles)
      if (!context.sectionHeading) {
        const headings = parent.querySelectorAll("h1, h2, h3, h4, h5, h6, strong, [class*='title'], [class*='heading'], [class*='header'], [class*='label']");
        for (const h of headings) {
          const text = h.textContent.trim();
          if (text && text.length < 80 && text.length > 1 && h !== el) {
            context.sectionHeading = text;
            break;
          }
        }
      }

      // Get nearby text nodes
      const text = getDirectTextContent(parent).trim();
      if (text && text.length < 200 && text.length > 1) {
        context.nearbyText.push(text);
      }
      parent = parent.parentElement;
      depth++;
    }

    // Find the closest preceding visible text that describes this field.
    // Walk backwards through previous siblings and their parents to find
    // section labels like "Location", "Interests", "Keywords", "Budget", etc.
    // This works universally across any ad platform's form structure.
    if (!context.sectionHeading) {
      context.sectionHeading = findPrecedingLabel(el);
    }

    return context;
  }

  /**
   * Find the closest preceding text that describes a form field.
   * Walks backwards and upward through the DOM to find section labels.
   *
   * Strategy:
   * 1. Check previous siblings for text content
   * 2. Walk up to parent, check its previous siblings
   * 3. Look for short text blocks (3-60 chars) that look like labels
   * 4. Stop at the first good match
   *
   * This works universally — any ad platform that has labels near fields.
   */
  function findPrecedingLabel(el) {
    let current = el;

    for (let depth = 0; depth < 6; depth++) {
      // Check previous siblings
      let sibling = current.previousElementSibling;
      let siblingCount = 0;

      while (sibling && siblingCount < 5) {
        // Get visible text from this sibling
        const text = sibling.textContent?.trim() || "";

        // A good label is short, not a button, and contains words
        if (
          text.length >= 2 &&
          text.length <= 80 &&
          sibling.tagName !== "BUTTON" &&
          sibling.tagName !== "INPUT" &&
          sibling.tagName !== "SELECT" &&
          !text.includes("Learn more") &&
          /[a-zA-Z]/.test(text)
        ) {
          // Prefer shorter, more label-like text
          const firstLine = text.split("\n")[0].trim();
          if (firstLine.length >= 2 && firstLine.length <= 80) {
            return firstLine;
          }
          return text.slice(0, 80);
        }

        sibling = sibling.previousElementSibling;
        siblingCount++;
      }

      // Move up to parent and try again
      current = current.parentElement;
      if (!current || current === document.body) break;
    }

    return "";
  }

  /**
   * Get direct text content of an element (not children's text).
   */
  function getDirectTextContent(el) {
    let text = "";
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }
    return text;
  }

  /**
   * Check if an element is visible on the page.
   */
  function isElementVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Find all interactive form elements on the page.
   */
  function findAllFormElements() {
    const selectors = [
      "input:not([type='hidden']):not([type='submit'])",
      "textarea",
      "select",
      "[contenteditable]",
      "[contenteditable='true']",
      "[contenteditable='plaintext-only']",
      "[role='textbox']",
      "[data-testid*='tweetText']",
      "[data-testid*='compose']",
      "[role='combobox']",
      "[role='listbox']",
      "[role='spinbutton']",
      "[role='slider']",
    ];

    const elements = document.querySelectorAll(selectors.join(", "));
    return Array.from(elements);
  }

  /**
   * Find all clickable elements (buttons, links, radio buttons, checkboxes).
   */
  function findAllClickables() {
    const selectors = [
      "button",
      "[role='button']",
      "[role='tab']",
      "[role='radio']",
      "[role='checkbox']",
      "[role='option']",
      "[role='menuitem']",
      "input[type='radio']",
      "input[type='checkbox']",
      "a[href]",
    ];

    const elements = document.querySelectorAll(selectors.join(", "));
    return Array.from(elements).filter(isElementVisible);
  }

  /**
   * Analyze the current page and return a full semantic map.
   */
  function analyzePage() {
    const formElements = findAllFormElements();
    const clickables = findAllClickables();

    const fields = formElements
      .map(getFieldContext)
      .filter((f) => f.isVisible && !f.isDisabled);

    const buttons = clickables.map((el) => ({
      element: el,
      text: el.textContent.trim(),
      ariaLabel: el.getAttribute("aria-label") || "",
      dataTestId: el.getAttribute("data-testid") || "",
      role: el.getAttribute("role") || el.tagName.toLowerCase(),
      isVisible: isElementVisible(el),
    }));

    return { fields, buttons };
  }

  /**
   * Search for a field matching a semantic description.
   * Uses fuzzy matching against all context properties.
   */
  function findField(pageMap, ...keywords) {
    const kw = keywords.map((k) => k.toLowerCase());

    let bestMatch = null;
    let bestScore = 0;

    for (const field of pageMap.fields) {
      let score = 0;
      const searchText = [
        field.labelText,
        field.ariaLabel,
        field.ariaLabelledBy,
        field.placeholder,
        field.name,
        field.id,
        field.dataTestId,
        field.dataAutomationId,
        ...field.nearbyText,
        field.parentText,
      ]
        .join(" ")
        .toLowerCase();

      for (const k of kw) {
        if (searchText.includes(k)) score += 10;
        // Bonus for exact match in label or aria
        if (field.labelText.toLowerCase().includes(k)) score += 20;
        if (field.ariaLabel.toLowerCase().includes(k)) score += 20;
        if (field.placeholder.toLowerCase().includes(k)) score += 15;
        if (field.name.toLowerCase().includes(k)) score += 15;
        if (field.dataTestId.toLowerCase().includes(k)) score += 10;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = field;
      }
    }

    return bestMatch;
  }

  /**
   * Search for a button matching a semantic description.
   */
  function findButton(pageMap, ...keywords) {
    const kw = keywords.map((k) => k.toLowerCase());

    let bestMatch = null;
    let bestScore = 0;

    for (const btn of pageMap.buttons) {
      let score = 0;
      const searchText = [btn.text, btn.ariaLabel, btn.dataTestId]
        .join(" ")
        .toLowerCase();

      for (const k of kw) {
        if (searchText.includes(k)) score += 10;
        if (btn.text.toLowerCase().includes(k)) score += 20;
        if (btn.ariaLabel.toLowerCase().includes(k)) score += 15;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = btn;
      }
    }

    return bestMatch;
  }

  /**
   * Take a snapshot of the current page state for debugging/logging.
   */
  function snapshot() {
    const pageMap = analyzePage();
    return {
      url: window.location.href,
      title: document.title,
      fieldCount: pageMap.fields.length,
      buttonCount: pageMap.buttons.length,
      fields: pageMap.fields.map((f) => ({
        tag: f.tagName,
        type: f.type,
        label: f.labelText || f.ariaLabel || f.placeholder || f.name || "(unknown)",
        id: f.id,
        name: f.name,
      })),
      buttons: pageMap.buttons.map((b) => ({
        text: b.text.slice(0, 50),
        role: b.role,
      })),
    };
  }

  /**
   * Produce a snapshot for the backend AI controller.
   * Includes indexed fields and buttons so the AI can reference them,
   * plus visible text for page context.
   * Also stores element references internally so we can execute
   * actions by index.
   */
  let _lastPageMap = null;

  function apiSnapshot() {
    const pageMap = analyzePage();
    _lastPageMap = pageMap;

    return {
      url: window.location.href,
      title: document.title,
      fields: pageMap.fields.map((f, i) => {
        // Count existing tokens near this field (for location/keyword/interest fields)
        // so the AI knows when items have already been selected
        let tokenCount = 0;
        let parent = f.element.parentElement;
        for (let d = 0; d < 5 && parent; d++) {
          const tokens = parent.querySelectorAll('[data-test-id-v2="token"]');
          if (tokens.length > 0) { tokenCount = tokens.length; break; }
          parent = parent.parentElement;
        }

        return {
          tag: f.tagName,
          type: f.type,
          label: f.labelText || f.ariaLabel || f.placeholder || f.name || "(unknown)",
          section: f.sectionHeading || f.nearbyText.slice(0, 2).join(" / ") || "",
          id: f.id,
          name: f.name,
          placeholder: f.placeholder,
          value: (f.element.value || f.element.textContent || "").slice(0, 50),
          tokens: tokenCount > 0 ? tokenCount : undefined, // e.g. "tokens: 5" = 5 locations already selected
          index: i,
        };
      }),
      // Keep original indices so getButtonByIndex works correctly
      // Filter out noise buttons that the AI doesn't need
      buttons: pageMap.buttons
        .map((b, i) => {
          const text = (b.text || "").trim();
          const lower = text.toLowerCase();
          const isNoise = !text || text.length >= 60 ||
            lower === "learn more" || lower === "bulk upload" ||
            lower === "measurement options" || lower === "brand safety controls" ||
            lower === "additional options" || lower === "×" || lower === "✕";
          return {
            text: text.slice(0, 50),
            ariaLabel: (b.ariaLabel || "").slice(0, 50),
            index: i,
            _skip: isNoise,
          };
        })
        .filter((b) => !b._skip)
        .map(({ _skip, ...rest }) => rest),
    };
  }

  /**
   * Get a field/button element by index from the last snapshot.
   */
  function getFieldByIndex(index) {
    return _lastPageMap?.fields[index]?.element || null;
  }

  function getButtonByIndex(index) {
    return _lastPageMap?.buttons[index]?.element || null;
  }

  return {
    analyzePage,
    findField,
    findButton,
    snapshot,
    apiSnapshot,
    getFieldByIndex,
    getButtonByIndex,
    isElementVisible,
    getFieldContext,
  };
})();

// Make available globally for other content scripts
window.__kalitDomAnalyzer = DomAnalyzer;
