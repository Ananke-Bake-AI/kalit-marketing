/**
 * Form Filler — Executes form fill actions with realistic input simulation
 *
 * Simulates human-like input to avoid being blocked by form validation
 * that only triggers on real user events (React, Angular, etc.)
 *
 * Each action is executed with proper event dispatching:
 * focus → clear → input chars → change → blur
 */

const FormFiller = (() => {
  /**
   * Simulate typing into a field with proper React/DOM events.
   */
  async function fillField(element, value) {
    if (!element || !element.isConnected) {
      console.warn("[Kalit FormFiller] fillField: element is detached or null");
      return;
    }
    // Focus the element
    try { element.focus(); } catch (e) { /* element may not be focusable */ }
    element.dispatchEvent(new Event("focus", { bubbles: true }));

    // Small delay to mimic human interaction
    await sleep(100);

    // Clear existing value
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      element.value = "";
      element.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (element.hasAttribute("contenteditable")) {
      element.textContent = "";
      element.innerHTML = "";
    }

    const isContentEditable = element.hasAttribute("contenteditable");
    const isInput = element.tagName === "INPUT" || element.tagName === "TEXTAREA";

    // For contenteditable, use execCommand('insertText') to trigger proper input events
    // (textContent doesn't trigger React/X's internal state updates)
    if (isContentEditable) {
      element.focus();
      // Select all existing content
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
      // Insert new text — triggers proper input events like real user typing
      document.execCommand('insertText', false, value);
      await sleep(100);
      // Fallback: if execCommand didn't work (some browsers), set directly
      if ((element.textContent || "").trim().length === 0) {
        element.textContent = value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(100);
      }
      return;
    }

    // For regular inputs, type character by character for React compatibility
    for (let i = 0; i < value.length; i++) {
      const char = value[i];

      element.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: char,
          code: `Key${char.toUpperCase()}`,
          bubbles: true,
        })
      );

      if (isInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          element.tagName === "INPUT"
            ? HTMLInputElement.prototype
            : HTMLTextAreaElement.prototype,
          "value"
        )?.set;

        if (nativeSetter) {
          nativeSetter.call(element, value.slice(0, i + 1));
        } else {
          element.value = value.slice(0, i + 1);
        }
      }

      // Use InputEvent with inputType — this is what React/X listens for
      element.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: char,
      }));

      // KeyUp
      element.dispatchEvent(
        new KeyboardEvent("keyup", {
          key: char,
          code: `Key${char.toUpperCase()}`,
          bubbles: true,
        })
      );

      // Small delay between characters (faster than human, but enough for React)
      if (i % 10 === 0) await sleep(10);
    }

    // Final change event
    element.dispatchEvent(new Event("change", { bubbles: true }));

    // Blur
    await sleep(50);
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  /**
   * Click an element with proper event simulation.
   */
  async function clickElement(element) {
    if (!element || !element.isConnected) {
      console.warn("[Kalit FormFiller] clickElement: element is detached or null");
      return;
    }
    try {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) { /* ignore scroll errors */ }
    await sleep(200);

    try {
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      element.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, clientX: x, clientY: y })
      );
      await sleep(50);
      element.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, clientX: x, clientY: y })
      );
      element.dispatchEvent(
        new MouseEvent("click", { bubbles: true, clientX: x, clientY: y })
      );
    } catch (e) {
      console.warn("[Kalit FormFiller] clickElement error:", e.message);
    }
  }

  /**
   * Select a dropdown option by matching text.
   */
  async function selectOption(element, optionText) {
    const text = optionText.toLowerCase();

    // Native <select>
    if (element.tagName === "SELECT") {
      const options = Array.from(element.options);
      const match = options.find((o) => o.text.toLowerCase().includes(text));
      if (match) {
        element.value = match.value;
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      return false;
    }

    // Custom dropdown — click to open, then find the option
    await clickElement(element);
    await sleep(300);

    // Look for options in the dropdown that appeared
    const optionSelectors = [
      "[role='option']",
      "[role='menuitem']",
      "[role='listbox'] > *",
      "li",
      "[class*='option']",
      "[class*='item']",
    ];

    for (const selector of optionSelectors) {
      const items = document.querySelectorAll(selector);
      for (const item of items) {
        if (
          item.textContent.toLowerCase().includes(text) &&
          window.__kalitDomAnalyzer.isElementVisible(item)
        ) {
          await clickElement(item);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Execute a list of form actions sequentially.
   * Returns a report of what was filled and what failed.
   */
  async function executeActions(actions) {
    const report = {
      total: actions.length,
      filled: 0,
      failed: 0,
      details: [],
    };

    for (const action of actions) {
      try {
        switch (action.action) {
          case "fill":
            await fillField(action.field, action.value);
            report.filled++;
            report.details.push({
              label: action.label,
              status: "filled",
              value: action.value.slice(0, 50),
            });
            break;

          case "click":
            await clickElement(action.field);
            report.filled++;
            report.details.push({
              label: action.label,
              status: "clicked",
            });
            break;

          case "select":
            const selected = await selectOption(action.field, action.value);
            if (selected) {
              report.filled++;
              report.details.push({
                label: action.label,
                status: "selected",
                value: action.value,
              });
            } else {
              report.failed++;
              report.details.push({
                label: action.label,
                status: "option_not_found",
                value: action.value,
              });
            }
            break;
        }

        // Pause between actions for the UI to settle
        await sleep(200);
      } catch (err) {
        report.failed++;
        report.details.push({
          label: action.label,
          status: "error",
          error: err.message,
        });
      }
    }

    return report;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  return {
    fillField,
    clickElement,
    selectOption,
    executeActions,
    sleep,
  };
})();

window.__kalitFormFiller = FormFiller;
