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
  adGroupPlatforms?: string[]; // All platforms that have ad groups in this campaign
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
  adGroupPlatforms = [],
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
            adGroups: campaign.adGroups
              ?.filter((ag: { platform?: string }) =>
                // Only send ad groups for this specific platform
                ag.platform === platform || (!ag.platform && !campaign.platform)
              )
              .map(
                (ag: {
                  name: string;
                  platform?: string;
                  targeting: Record<string, unknown>;
                  creatives: Array<{
                    creative: {
                      content: Record<string, unknown>;
                    };
                  }>;
                }) => ({
                  name: ag.name,
                  platform: ag.platform,
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
  const browserDeployPlatforms = ["x", "google"];

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

  // All platforms in this campaign (from ad groups)
  const platforms = adGroupPlatforms.length > 0 ? adGroupPlatforms : (campaignPlatform ? [campaignPlatform] : []);
  const isDeployable = ["draft", "pending_approval", "approved", "failed"].includes(status);
  const isLive = ["active", "paused", "optimizing", "scaling", "launching", "monitoring"].includes(status);

  return (
    <div className="space-y-4">
      {/* ── Unified Deployment Card ── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">Deployment</p>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-text-secondary" />}
        </div>

        {/* Platform rows — one per platform */}
        {platforms.map((platform) => {
          const isBrowser = browserDeployPlatforms.includes(platform);
          const pLabel = platformLabels[platform] || platform;

          return (
            <div key={platform} className="flex items-center justify-between py-2.5 border-b border-divider last:border-0">
              <div className="flex items-center gap-2.5">
                <span className={`w-2 h-2 rounded-full ${isLive ? "bg-emerald-400" : status === "failed" ? "bg-red-400" : "bg-zinc-500"}`} />
                <span className="text-sm font-medium text-text">{pLabel}</span>
                <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 ${
                  isLive ? "bg-emerald-500/15 text-emerald-600" :
                  status === "failed" ? "bg-red-500/15 text-red-400" :
                  "bg-zinc-500/15 text-text-secondary"
                }`}>
                  {status.replace(/_/g, " ")}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Browser deploy (X) */}
                {isDeployable && isBrowser && (
                  <button
                    onClick={() => handleBrowserDeploy(platform)}
                    disabled={!extensionDetected || browserDeployStatus === "deploying"}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors disabled:opacity-40"
                  >
                    {browserDeployStatus === "deploying" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
                    Deploy
                  </button>
                )}
                {/* API deploy (Google, Meta, etc.) */}
                {isDeployable && !isBrowser && (
                  <button
                    onClick={() => handleLaunch(platform)}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors disabled:opacity-40"
                  >
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
                    Launch
                  </button>
                )}
                {/* Sync (live browser platforms) */}
                {isLive && isBrowser && (
                  <button
                    onClick={() => handleBrowserSync(platform)}
                    disabled={!extensionDetected || syncStatus === "syncing"}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-subtle text-text-secondary border border-divider hover:border-divider transition-colors disabled:opacity-40"
                  >
                    {syncStatus === "syncing" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Sync
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {platforms.length === 0 && (
          <p className="text-[10px] text-text-secondary">No platforms configured for this campaign.</p>
        )}

        {/* Status messages */}
        {browserDeployStatus === "queued" && (
          <p className="text-[10px] text-accent animate-pulse">Opening ad platform...</p>
        )}
        {browserDeployStatus === "success" && (
          <p className="text-[10px] text-emerald-600">Form filled — review and confirm live below</p>
        )}
        {syncStatus === "success" && syncResult && (
          <p className="text-[10px] text-emerald-600">Synced {syncResult.campaignCount} campaign{syncResult.campaignCount !== 1 ? "s" : ""}, {syncResult.metricsFound} metrics</p>
        )}

        {/* Extension missing for browser platforms */}
        {platforms.some(p => browserDeployPlatforms.includes(p)) && !extensionDetected && isDeployable && (
          <p className="text-[10px] text-text-secondary">
            <a href="/dashboard/connections" className="text-accent underline hover:text-accent/80">Install the Kalit extension</a> to deploy via browser
          </p>
        )}

        {/* Quick actions bar */}
        {isDeployable && (
          <div className="flex items-center gap-2 pt-2 border-t border-divider">
            {(status === "draft" || status === "pending_approval") && (
              <button onClick={() => handleAction("approve")} disabled={loading}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-emerald-600 hover:bg-emerald-500/10 transition-colors disabled:opacity-40">
                <CheckCircle className="h-3 w-3" /> Approve
              </button>
            )}
            {(status === "draft" || status === "pending_approval" || status === "approved") && (
              <button onClick={() => handleAction("reject")} disabled={loading}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-text-secondary hover:text-red-400 transition-colors disabled:opacity-40">
                <XCircle className="h-3 w-3" /> Reject
              </button>
            )}
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
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-text-secondary hover:text-accent transition-colors disabled:opacity-40 ml-auto">
              <CheckCircle className="h-3 w-3" /> Mark as Live
            </button>
          </div>
        )}

        {/* Pause / Resume for live campaigns */}
        {isLive && (
          <div className="flex items-center gap-2 pt-2 border-t border-divider">
            {status !== "paused" ? (
              <button onClick={() => handleAction("pause")} disabled={loading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-40">
                <Pause className="h-3 w-3" /> Pause
              </button>
            ) : (
              <button onClick={() => handleAction("resume")} disabled={loading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-emerald-600 hover:bg-emerald-500/10 transition-colors disabled:opacity-40">
                <Play className="h-3 w-3" /> Resume
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
        <div key={i} className={`p-3 border text-xs ${r.success ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
          <p className="font-medium">{r.platform} — {r.success ? "Launched" : "Failed"}</p>
          {r.error && <p className="mt-1 opacity-80">{r.error}</p>}
        </div>
      ))}
    </div>
  );
}
