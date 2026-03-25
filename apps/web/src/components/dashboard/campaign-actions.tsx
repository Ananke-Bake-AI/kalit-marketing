"use client";

import { useState, useEffect } from "react";
import {
  Rocket,
  CheckCircle,
  Pause,
  Play,
  XCircle,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Trash2,
  RefreshCw,
} from "lucide-react";

interface ConnectedAccount {
  id: string;
  platform: string;
  accountName: string | null;
}

interface CampaignActionsProps {
  campaignId: string;
  workspaceId: string;
  status: string;
  platformCampaignIds: Record<string, string> | null;
  hasConnectedAccounts: boolean;
  campaignPlatform?: string | null;
  connectedAccounts?: ConnectedAccount[];
}

const platformLabels: Record<string, string> = {
  google: "Google Ads",
  meta: "Meta Ads",
  tiktok: "TikTok Ads",
  reddit: "Reddit Ads",
  linkedin: "LinkedIn Ads",
  x: "X Ads",
};

interface LaunchResult {
  success: boolean;
  results?: Array<{
    campaignId: string;
    platform: string;
    success: boolean;
    platformCampaignId?: string;
    error?: string;
    steps: Array<{
      entity: string;
      entityId: string;
      platformId?: string;
      status: string;
      error?: string;
    }>;
  }>;
  error?: string;
}

export function CampaignActions({
  campaignId,
  workspaceId,
  status: initialStatus,
  platformCampaignIds,
  hasConnectedAccounts,
  campaignPlatform,
  connectedAccounts = [],
}: CampaignActionsProps) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>(
    campaignPlatform || connectedAccounts[0]?.platform || ""
  );
  const [showPlatformWarning, setShowPlatformWarning] = useState(false);
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [browserDeployStatus, setBrowserDeployStatus] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ campaignCount: number; metricsFound: number } | null>(null);

  const matchingAccounts = connectedAccounts.filter(a => a.platform === campaignPlatform);
  const otherAccounts = connectedAccounts.filter(a => a.platform !== campaignPlatform);

  // Detect Kalit extension
  useEffect(() => {
    if (typeof window === "undefined") return;

    const detected = document.documentElement.getAttribute("data-kalit-extension") === "true";
    setExtensionDetected(detected);

    // Listen for extension ready event (if loaded after this component)
    const handler = () => setExtensionDetected(true);
    window.addEventListener("kalit-extension-ready", handler);

    // Listen for deploy results (form filled on ad platform)
    const resultHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setBrowserDeployStatus(detail.success ? "success" : "failed");
    };
    window.addEventListener("kalit-deploy-result", resultHandler);

    // Listen for deploy confirmation (user confirmed campaign is live)
    const confirmedHandler = async () => {
      setBrowserDeployStatus("confirmed");
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/campaigns/${campaignId}/launch`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "browser_deployed" }),
          }
        );
        if (res.ok) {
          setStatus("active");
        }
      } catch {
        // Status update failed silently
      }
    };
    window.addEventListener("kalit-deploy-confirmed", confirmedHandler);

    // Listen for sync results
    const syncQueuedHandler = () => setSyncStatus("syncing");
    const syncResultHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.success) {
        setSyncStatus("success");
        setSyncResult(detail.summary || null);
      } else {
        setSyncStatus("failed");
      }
    };
    window.addEventListener("kalit-sync-queued", syncQueuedHandler);
    window.addEventListener("kalit-sync-result", syncResultHandler);

    return () => {
      window.removeEventListener("kalit-extension-ready", handler);
      window.removeEventListener("kalit-deploy-result", resultHandler);
      window.removeEventListener("kalit-deploy-confirmed", confirmedHandler);
      window.removeEventListener("kalit-sync-queued", syncQueuedHandler);
      window.removeEventListener("kalit-sync-result", syncResultHandler);
    };
  }, []);

  // Browser-based deployment (via extension)
  async function handleBrowserDeploy(platform: string) {
    setBrowserDeployStatus("deploying");

    try {
      // Fetch full campaign data with ad groups and creatives
      const res = await fetch(
        `/api/workspaces/${workspaceId}/campaigns?includeAdGroups=true`
      );
      if (!res.ok) throw new Error("Failed to fetch campaigns");

      const campaigns = await res.json();
      const campaign = campaigns.find(
        (c: { id: string }) => c.id === campaignId
      );

      if (!campaign) throw new Error("Campaign not found");

      // Send to extension via postMessage
      window.postMessage(
        {
          type: "KALIT_DEPLOY",
          platform,
          campaign: {
            name: campaign.name,
            objective: campaign.objective,
            conversionEvent: campaign.platformCampaignIds?.conversionEvent || "lead generation",
            dailyBudget: campaign.dailyBudget,
            totalBudget: campaign.totalBudget,
            currency: campaign.currency,
            targetAudience: campaign.targetAudience,
            messagingAngle: campaign.messagingAngle,
            platform,
            adGroups: campaign.adGroups?.map(
              (ag: {
                name: string;
                targeting: Record<string, unknown>;
                creatives: Array<{
                  creative: {
                    content: Record<string, unknown>;
                  };
                }>;
              }) => ({
                name: ag.name,
                targeting: ag.targeting,
                creatives: ag.creatives?.map(
                  (c: {
                    creative: { content: Record<string, unknown> };
                  }) => ({
                    ...c.creative?.content,
                  })
                ),
              })
            ),
          },
        },
        window.location.origin
      );

      setBrowserDeployStatus("queued");
    } catch {
      setBrowserDeployStatus("failed");
    }
  }

  // Sync performance data from ad platform via browser extension
  function handleBrowserSync(platform: string) {
    setSyncStatus("opening");
    setSyncResult(null);

    window.postMessage(
      {
        type: "KALIT_SYNC",
        platform,
        workspaceId,
        apiEndpoint: `${window.location.origin}/api/workspaces/${workspaceId}/sync/browser`,
      },
      window.location.origin
    );
  }

  // Platforms that support browser deploy (no API needed)
  const browserDeployPlatforms = ["x"];

  const apiBase = `/api/workspaces/${workspaceId}/campaigns/${campaignId}/launch`;

  async function handleAction(action: string) {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Action failed");
        return;
      }

      setStatus(data.campaign.status);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunch(platform?: string) {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const data = await res.json();

      if (data.results) {
        setResult(data);
        // Update status based on results
        const anySuccess = data.results.some(
          (r: { success: boolean }) => r.success
        );
        if (anySuccess) {
          setStatus("active");
        }
      } else if (data.error) {
        setError(data.error);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const platformLinks: Record<string, string> = {
    google: "https://ads.google.com/aw/campaigns",
    meta: "https://business.facebook.com/adsmanager/manage/campaigns",
  };

  const isBrowserPlatform = browserDeployPlatforms.includes(campaignPlatform || "");
  const isDeployable = ["draft", "pending_approval", "approved", "failed"].includes(status);
  const isLive = ["active", "paused", "optimizing", "scaling", "launching", "monitoring"].includes(status);
  const pLabel = platformLabels[campaignPlatform || ""] || campaignPlatform || "—";

  return (
    <div className="space-y-4">
      {/* ── Unified Deployment Card ── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Deployment</p>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />}
        </div>

        {/* Platform row — current platform */}
        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <span className={`w-2 h-2 rounded-full ${isLive ? "bg-emerald-400" : status === "failed" ? "bg-red-400" : "bg-zinc-500"}`} />
            <span className="text-sm font-medium text-white">{pLabel}</span>
            <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 ${
              isLive ? "bg-emerald-500/15 text-emerald-400" :
              status === "failed" ? "bg-red-500/15 text-red-400" :
              "bg-zinc-500/15 text-zinc-400"
            }`}>
              {status.replace(/_/g, " ")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Deploy action */}
            {isDeployable && isBrowserPlatform && (
              <button
                onClick={() => handleBrowserDeploy(campaignPlatform || "x")}
                disabled={!extensionDetected || browserDeployStatus === "deploying"}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors disabled:opacity-40"
              >
                {browserDeployStatus === "deploying" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
                Deploy
              </button>
            )}
            {isDeployable && !isBrowserPlatform && (
              <button
                onClick={() => handleLaunch(campaignPlatform || undefined)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors disabled:opacity-40"
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
                Launch
              </button>
            )}

            {/* Mark as live */}
            {isDeployable && isBrowserPlatform && browserDeployStatus === "success" && (
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch(`/api/workspaces/${workspaceId}/campaigns/${campaignId}/launch`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "browser_deployed" }),
                    });
                    if (res.ok) setStatus("active");
                  } catch { /* ignore */ } finally { setLoading(false); }
                }}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors disabled:opacity-40"
              >
                <CheckCircle className="h-3 w-3" />
                Confirm Live
              </button>
            )}

            {/* Sync (live platforms) */}
            {isLive && isBrowserPlatform && (
              <button
                onClick={() => handleBrowserSync(campaignPlatform || "x")}
                disabled={!extensionDetected || syncStatus === "syncing"}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-white/5 text-slate-400 border border-white/10 hover:border-white/20 transition-colors disabled:opacity-40"
              >
                {syncStatus === "syncing" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Sync
              </button>
            )}

            {/* Pause / Resume */}
            {isLive && status !== "paused" && (
              <button onClick={() => handleAction("pause")} disabled={loading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-40">
                <Pause className="h-3 w-3" /> Pause
              </button>
            )}
            {status === "paused" && (
              <button onClick={() => handleAction("resume")} disabled={loading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40">
                <Play className="h-3 w-3" /> Resume
              </button>
            )}
          </div>
        </div>

        {/* Status messages */}
        {browserDeployStatus === "queued" && (
          <p className="text-[10px] text-accent animate-pulse">Opening {pLabel}...</p>
        )}
        {browserDeployStatus === "success" && (
          <p className="text-[10px] text-emerald-400">Form filled — review on {pLabel}, then click &quot;Confirm Live&quot; above</p>
        )}
        {syncStatus === "success" && syncResult && (
          <p className="text-[10px] text-emerald-400">Synced {syncResult.campaignCount} campaign{syncResult.campaignCount !== 1 ? "s" : ""}, {syncResult.metricsFound} metrics</p>
        )}

        {/* Extension missing warning */}
        {isBrowserPlatform && !extensionDetected && isDeployable && (
          <p className="text-[10px] text-slate-500">
            <a href="/dashboard/connections" className="text-accent underline hover:text-accent/80">Install the Kalit extension</a> to deploy via browser
          </p>
        )}

        {/* Quick actions bar */}
        {isDeployable && (
          <div className="flex items-center gap-2 pt-2 border-t border-white/5">
            {(status === "draft" || status === "pending_approval") && (
              <button onClick={() => handleAction("approve")} disabled={loading}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40">
                <CheckCircle className="h-3 w-3" /> Approve
              </button>
            )}
            {(status === "draft" || status === "pending_approval" || status === "approved") && (
              <button onClick={() => handleAction("reject")} disabled={loading}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-40">
                <XCircle className="h-3 w-3" /> Reject
              </button>
            )}
            {isBrowserPlatform && (
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch(`/api/workspaces/${workspaceId}/campaigns/${campaignId}/launch`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "browser_deployed" }),
                    });
                    if (res.ok) setStatus("active");
                  } catch { /* ignore */ } finally { setLoading(false); }
                }}
                disabled={loading}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-slate-500 hover:text-accent transition-colors disabled:opacity-40 ml-auto">
                <CheckCircle className="h-3 w-3" /> Mark as Live
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <p className="font-medium">Error</p>
          <p className="mt-1 text-red-400/80">{error}</p>
        </div>
      )}

      {/* Launch results */}
      {result?.results?.map((r, i) => (
        <div key={i} className={`p-3 border text-xs ${r.success ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
          <p className="font-medium">{r.platform} — {r.success ? "Launched" : "Failed"}</p>
          {r.error && <p className="mt-1 opacity-80">{r.error}</p>}
        </div>
      ))}
    </div>
  );
}
