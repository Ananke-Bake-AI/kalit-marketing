/**
 * Kalit Marketing — Extension Background Service Worker
 *
 * Coordinates between the Kalit dashboard tab and the ad platform tab.
 * Receives campaign data from the bridge, stores it, opens the target
 * platform, and forwards the data to the automator content script.
 */

// In-memory store for pending deployments
let pendingDeployment = null;

// API origins (background worker can call these without CORS issues)
const API_ORIGINS = ["http://localhost:3002", "https://marketing.kalit.ai"];
let apiOrigin = API_ORIGINS[0];

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "AI_ACT": {
      // Proxy the AI controller request through the background worker (bypasses CORS)
      const { payload } = message;
      const reqStart = Date.now();

      fetch(`${apiOrigin}/api/extension/act`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => {
          if (!res.ok) {
            return res.text().then((text) => {
              throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
            });
          }
          return res.json();
        })
        .then((data) => {
          // Save the full AI interaction for debugging
          chrome.storage.local.get("aiInteractions", (stored) => {
            const interactions = stored.aiInteractions || [];
            interactions.push({
              timestamp: new Date().toISOString(),
              step: payload.history?.length + 1 || 1,
              roundtripMs: Date.now() - reqStart,
              request: {
                url: payload.snapshot?.url,
                fieldCount: payload.snapshot?.fields?.length,
                buttonCount: payload.snapshot?.buttons?.length,
                historySteps: payload.history?.length || 0,
                // Save compact field/button lists for debugging
                fields: payload.snapshot?.fields?.map(f => `[F${f.index}] ${f.label} val="${(f.value||"").slice(0,30)}"`) || [],
                buttons: payload.snapshot?.buttons?.map(b => `[B${b.index}] ${b.text}`) || [],
              },
              response: {
                actions: data.actions,
                elapsed: data.elapsed,
                tokensUsed: data.tokensUsed,
              },
            });
            // Keep last 50 interactions
            chrome.storage.local.set({ aiInteractions: interactions.slice(-50) });
          });

          sendResponse(data);
        })
        .catch((err) => {
          // Save errors too
          chrome.storage.local.get("aiInteractions", (stored) => {
            const interactions = stored.aiInteractions || [];
            interactions.push({
              timestamp: new Date().toISOString(),
              step: payload.history?.length + 1 || 1,
              roundtripMs: Date.now() - reqStart,
              error: err.message,
            });
            chrome.storage.local.set({ aiInteractions: interactions.slice(-50) });
          });

          sendResponse({ error: err.message, actions: [{ type: "done", reason: "API error — manual intervention needed" }] });
        });

      return true; // async response
    }

    case "AI_CRAWL": {
      // Proxy the crawl AI request through the background worker (bypasses CORS)
      const { payload: crawlPayload } = message;

      fetch(`${apiOrigin}/api/extension/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(crawlPayload),
      })
        .then((res) => {
          if (!res.ok) {
            return res.text().then((text) => {
              throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
            });
          }
          return res.json();
        })
        .then((data) => sendResponse(data))
        .catch((err) => sendResponse({ error: err.message }));

      return true; // async response
    }

    case "KALIT_DEPLOY": {
      // Received campaign data from the Kalit dashboard bridge
      pendingDeployment = {
        campaign: message.campaign,
        platform: message.platform,
        timestamp: Date.now(),
      };

      // Store in extension storage for persistence across tab opens
      chrome.storage.local.set({ pendingDeployment });

      // Open the ad platform in a new tab
      const platformUrls = {
        x: "https://ads.x.com",
        google: "https://ads.google.com/aw/overview",
        meta: "https://adsmanager.facebook.com",
        linkedin: "https://www.linkedin.com/campaignmanager/",
        tiktok: "https://ads.tiktok.com/",
        reddit: "https://ads.reddit.com/",
      };

      const url = platformUrls[message.platform];
      if (url) {
        chrome.tabs.create({ url }, (tab) => {
          // Store which tab is our target so the automator knows
          chrome.storage.local.set({ deployTabId: tab.id });
        });
      }

      sendResponse({ status: "ok", message: "Deployment queued" });
      break;
    }

    case "AUTOMATOR_READY": {
      // The ad platform tab's automator script is loaded and ready
      // Always check storage first (async path) to avoid race condition
      // where in-memory pendingDeployment is stale or not yet set
      chrome.storage.local.get("pendingDeployment", (data) => {
        if (data.pendingDeployment) {
          pendingDeployment = data.pendingDeployment;
          sendResponse({
            status: "ok",
            deployment: pendingDeployment,
          });
        } else if (pendingDeployment) {
          // Fallback to in-memory if storage was cleared but memory still has it
          sendResponse({
            status: "ok",
            deployment: pendingDeployment,
          });
        } else {
          sendResponse({ status: "no_deployment" });
        }
      });
      return true; // async response
    }

    case "DEPLOY_CONFIRMED": {
      // User confirmed the campaign is live on the ad platform
      chrome.tabs.query(
        { url: ["http://localhost:3002/*", "https://marketing.kalit.ai/*"] },
        (tabs) => {
          for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, {
              type: "DEPLOY_CONFIRMED",
              platform: message.platform,
            });
          }
        }
      );
      sendResponse({ status: "ok" });
      break;
    }

    case "DEPLOY_COMPLETE": {
      // Automator finished — clear the pending deployment
      pendingDeployment = null;
      chrome.storage.local.remove(["pendingDeployment", "deployTabId"]);

      // Notify the Kalit dashboard tab
      chrome.tabs.query(
        { url: ["http://localhost:3002/*", "https://marketing.kalit.ai/*"] },
        (tabs) => {
          for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, {
              type: "DEPLOY_RESULT",
              success: message.success,
              platform: message.platform,
              details: message.details,
            });
          }
        }
      );

      sendResponse({ status: "ok" });
      break;
    }

    case "DEPLOY_ERROR": {
      // Something went wrong — notify dashboard
      chrome.tabs.query(
        { url: ["http://localhost:3002/*", "https://marketing.kalit.ai/*"] },
        (tabs) => {
          for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, {
              type: "DEPLOY_RESULT",
              success: false,
              platform: message.platform,
              error: message.error,
            });
          }
        }
      );

      sendResponse({ status: "ok" });
      break;
    }

    case "KALIT_SYNC": {
      // Dashboard requested a performance sync — open the platform's reporting page
      const syncUrls = {
        x: "https://ads.x.com",
      };

      const syncUrl = syncUrls[message.platform];
      if (syncUrl) {
        // Store sync request
        chrome.storage.local.set({
          pendingSync: {
            platform: message.platform,
            workspaceId: message.workspaceId,
            apiEndpoint: message.apiEndpoint,
            timestamp: Date.now(),
          },
        });

        chrome.tabs.create({ url: syncUrl }, (tab) => {
          chrome.storage.local.set({ syncTabId: tab.id });
        });
      }

      sendResponse({ status: "ok" });
      break;
    }

    case "SYNC_READY": {
      // The ads platform tab is ready to scrape — send it the sync request
      chrome.storage.local.get("pendingSync", (data) => {
        if (data.pendingSync) {
          sendResponse({ status: "ok", sync: data.pendingSync });
        } else {
          sendResponse({ status: "no_sync" });
        }
      });
      return true; // async
    }

    case "SYNC_DATA": {
      // Scraper extracted performance data — forward to Kalit API
      const { syncData, apiEndpoint } = message;

      // Send to Kalit backend
      fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(syncData),
      })
        .then((res) => res.json())
        .then((result) => {
          // Notify dashboard
          chrome.tabs.query(
            { url: ["http://localhost:3002/*", "https://marketing.kalit.ai/*"] },
            (tabs) => {
              for (const tab of tabs) {
                chrome.tabs.sendMessage(tab.id, {
                  type: "SYNC_RESULT",
                  success: true,
                  platform: syncData.platform,
                  summary: {
                    campaignCount: syncData.campaigns?.length || 0,
                    metricsFound: Object.keys(syncData.summary || {}).length,
                  },
                });
              }
            }
          );
        })
        .catch((err) => {
          chrome.tabs.query(
            { url: ["http://localhost:3002/*", "https://marketing.kalit.ai/*"] },
            (tabs) => {
              for (const tab of tabs) {
                chrome.tabs.sendMessage(tab.id, {
                  type: "SYNC_RESULT",
                  success: false,
                  error: err.message,
                });
              }
            }
          );
        });

      // Clean up
      chrome.storage.local.remove(["pendingSync", "syncTabId"]);
      sendResponse({ status: "ok" });
      break;
    }

    case "GET_STATUS": {
      chrome.storage.local.get("pendingSync", (data) => {
        sendResponse({
          hasPending: !!pendingDeployment,
          deployment: pendingDeployment,
          hasPendingSync: !!data.pendingSync,
        });
      });
      return true; // async
    }

    case "GET_LOGS": {
      // Return all saved logs and AI interactions for debugging
      chrome.storage.local.get(["deployLogs", "aiInteractions"], (data) => {
        sendResponse({
          logs: data.deployLogs || null,
          interactions: data.aiInteractions || [],
        });
      });
      return true;
    }

    case "CLEAR_LOGS": {
      chrome.storage.local.remove(["deployLogs", "aiInteractions"]);
      sendResponse({ status: "ok" });
      break;
    }

    case "CAPTURE_PAGE": {
      // Capture the current page HTML for skill generation
      // Sent by the automator when it encounters a new page
      const { pageHtml, pageName, platform: capturePlatform } = message;

      // Store captured pages for batch skill generation
      chrome.storage.local.get("capturedPages", (stored) => {
        const pages = stored.capturedPages || {};
        if (!pages[capturePlatform]) pages[capturePlatform] = [];

        // Don't duplicate
        const exists = pages[capturePlatform].some(p => p.name === pageName);
        if (!exists) {
          pages[capturePlatform].push({ name: pageName, html: pageHtml });
        }

        chrome.storage.local.set({ capturedPages: pages });
        sendResponse({ status: "ok", pageCount: pages[capturePlatform].length });
      });
      return true;
    }

    case "GENERATE_SKILL": {
      // Trigger skill generation from captured pages
      const { platform: skillPlatform } = message;

      chrome.storage.local.get("capturedPages", (stored) => {
        const pages = stored.capturedPages?.[skillPlatform] || [];
        if (pages.length === 0) {
          sendResponse({ status: "error", error: "No captured pages" });
          return;
        }

        fetch(`${apiOrigin}/api/extension/skills`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform: skillPlatform, pages }),
        })
          .then((res) => res.json())
          .then((data) => sendResponse(data))
          .catch((err) => sendResponse({ error: err.message }));
      });
      return true;
    }

    case "FOCUS_TAB": {
      // Ensure the ad platform tab is focused — dropdowns won't render in background tabs
      if (sender.tab?.id) {
        chrome.tabs.update(sender.tab.id, { active: true });
        if (sender.tab.windowId) {
          chrome.windows.update(sender.tab.windowId, { focused: true });
        }
      }
      sendResponse({ status: "ok" });
      break;
    }

    case "SAVE_LOGS": {
      // Persist logs + AI interactions to the backend file
      chrome.storage.local.get("aiInteractions", (stored) => {
        const payload = {
          logs: message.logs,
          interactions: stored.aiInteractions || [],
        };
        fetch(`${apiOrigin}/api/extension/logs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => {}); // best-effort
      });
      sendResponse({ status: "ok" });
      break;
    }
  }

  // Return true for async sendResponse
  return true;
});
