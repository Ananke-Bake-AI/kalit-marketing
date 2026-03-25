/**
 * Kalit Bridge — Content script for Kalit Marketing dashboard pages
 *
 * Listens for deployment events from the dashboard and forwards
 * campaign data to the extension's background service worker.
 *
 * Also receives deployment results back from the background worker
 * and dispatches them as custom events for the dashboard to handle.
 */

(() => {
  console.log("[Kalit Extension] Bridge loaded on", window.location.origin);

  // Listen for deploy events from the Kalit dashboard
  window.addEventListener("message", (event) => {
    // Only accept messages from our own page
    if (event.source !== window) return;

    if (event.data?.type === "KALIT_SYNC") {
      console.log("[Kalit Extension] Sync request received:", event.data.platform);

      chrome.runtime.sendMessage(
        {
          type: "KALIT_SYNC",
          platform: event.data.platform,
          workspaceId: event.data.workspaceId,
          apiEndpoint: event.data.apiEndpoint,
        },
        (response) => {
          if (response?.status === "ok") {
            window.dispatchEvent(
              new CustomEvent("kalit-sync-queued", {
                detail: { platform: event.data.platform },
              })
            );
          }
        }
      );
    }

    if (event.data?.type === "KALIT_DEPLOY") {
      console.log("[Kalit Extension] Deploy request received:", event.data.platform);

      // Forward to background service worker
      chrome.runtime.sendMessage(
        {
          type: "KALIT_DEPLOY",
          platform: event.data.platform,
          campaign: event.data.campaign,
        },
        (response) => {
          if (response?.status === "ok") {
            // Dispatch success event to the page
            window.dispatchEvent(
              new CustomEvent("kalit-deploy-queued", {
                detail: { platform: event.data.platform },
              })
            );
          }
        }
      );
    }
  });

  // Listen for results from the background worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "SYNC_RESULT") {
      console.log("[Kalit Extension] Sync result:", message);
      window.dispatchEvent(
        new CustomEvent("kalit-sync-result", {
          detail: {
            success: message.success,
            platform: message.platform,
            summary: message.summary,
            error: message.error,
          },
        })
      );
    }

    if (message.type === "DEPLOY_RESULT") {
      console.log("[Kalit Extension] Deploy result:", message);

      // Dispatch result event to the dashboard page
      window.dispatchEvent(
        new CustomEvent("kalit-deploy-result", {
          detail: {
            success: message.success,
            platform: message.platform,
            details: message.details,
            error: message.error,
          },
        })
      );
    }

    if (message.type === "DEPLOY_CONFIRMED") {
      console.log("[Kalit Extension] Deploy confirmed:", message.platform);

      // User confirmed the campaign is live on the ad platform
      window.dispatchEvent(
        new CustomEvent("kalit-deploy-confirmed", {
          detail: { platform: message.platform },
        })
      );
    }
  });

  // Handle log retrieval requests from the dashboard page
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (event.data?.type === "KALIT_GET_LOGS") {
      chrome.runtime.sendMessage({ type: "GET_LOGS" }, (response) => {
        window.dispatchEvent(
          new CustomEvent("kalit-logs", { detail: response })
        );
      });
    }

    if (event.data?.type === "KALIT_CLEAR_LOGS") {
      chrome.runtime.sendMessage({ type: "CLEAR_LOGS" });
    }
  });

  // Let the page know the extension is installed
  window.dispatchEvent(new CustomEvent("kalit-extension-ready"));

  // Also set a flag on the document for the dashboard to detect
  document.documentElement.setAttribute("data-kalit-extension", "true");
})();
