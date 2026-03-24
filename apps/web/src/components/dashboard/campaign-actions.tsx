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

    // Listen for deploy results
    const resultHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setBrowserDeployStatus(detail.success ? "success" : "failed");
    };
    window.addEventListener("kalit-deploy-result", resultHandler);

    return () => {
      window.removeEventListener("kalit-extension-ready", handler);
      window.removeEventListener("kalit-deploy-result", resultHandler);
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

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Draft / Pending → Approve */}
        {(status === "draft" || status === "pending_approval") && (
          <>
            <button
              onClick={() => handleAction("approve")}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Approve
            </button>
            <button
              onClick={() => handleLaunch(selectedPlatform || undefined)}
              disabled={loading || !hasConnectedAccounts}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors disabled:opacity-50"
              title={
                !hasConnectedAccounts
                  ? "Connect an ad platform account first"
                  : undefined
              }
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Rocket className="h-3.5 w-3.5" />
              )}
              Approve & Launch{selectedPlatform ? ` on ${platformLabels[selectedPlatform] || selectedPlatform}` : ""}
            </button>
          </>
        )}

        {/* Approved → Launch */}
        {status === "approved" && (
          <button
            onClick={() => handleLaunch(selectedPlatform || undefined)}
            disabled={loading || !hasConnectedAccounts}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Rocket className="h-3.5 w-3.5" />
            )}
            Launch on {selectedPlatform ? platformLabels[selectedPlatform] || selectedPlatform : "Platform"}
          </button>
        )}

        {/* Failed → Retry */}
        {status === "failed" && (
          <button
            onClick={() => handleLaunch(selectedPlatform || undefined)}
            disabled={loading || !hasConnectedAccounts}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Rocket className="h-3.5 w-3.5" />
            )}
            Retry Launch
          </button>
        )}

        {/* Active → Pause */}
        {(status === "active" || status === "optimizing" || status === "scaling") && (
          <button
            onClick={() => handleAction("pause")}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30 hover:bg-orange-500/25 transition-colors disabled:opacity-50"
          >
            <Pause className="h-3.5 w-3.5" />
            Pause
          </button>
        )}

        {/* Paused → Resume */}
        {status === "paused" && (
          <button
            onClick={() => handleAction("resume")}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            Resume
          </button>
        )}

        {/* Reject (any non-active state) */}
        {(status === "draft" || status === "pending_approval" || status === "approved") && (
          <button
            onClick={() => handleAction("reject")}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            <XCircle className="h-3.5 w-3.5" />
            Reject
          </button>
        )}

        {/* Remove (active, paused, failed, completed) — deletes from platform */}
        {["active", "paused", "optimizing", "scaling", "failed", "completed"].includes(status) && !confirmRemove && (
          <button
            onClick={() => setConfirmRemove(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
        {confirmRemove && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-red-400">Remove from platform?</span>
            <button
              onClick={() => { handleAction("remove"); setConfirmRemove(false); }}
              disabled={loading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Yes, Remove
            </button>
            <button
              onClick={() => setConfirmRemove(false)}
              className="text-[10px] text-zinc-500 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {loading && (
          <span className="text-[10px] text-slate-500 animate-pulse">
            Processing...
          </span>
        )}
      </div>

      {/* Platform selector for deployment */}
      {connectedAccounts.length > 0 &&
        ["draft", "pending_approval", "approved", "failed"].includes(status) && (
          <div className="card p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
              Deploy to platform
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Matching accounts first */}
              {matchingAccounts.map(a => (
                <button
                  key={a.id}
                  onClick={() => { setSelectedPlatform(a.platform); setShowPlatformWarning(false); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-colors ${
                    selectedPlatform === a.platform
                      ? "bg-accent/15 text-accent border-accent/30"
                      : "bg-white/5 text-slate-400 border-white/10 hover:border-white/20"
                  }`}
                >
                  {platformLabels[a.platform] || a.platform}
                  {a.accountName && <span className="text-slate-500">({a.accountName})</span>}
                  {campaignPlatform === a.platform && (
                    <span className="text-[9px] text-emerald-400 ml-1">recommended</span>
                  )}
                </button>
              ))}
              {/* Other accounts */}
              {otherAccounts.map(a => (
                <button
                  key={a.id}
                  onClick={() => { setSelectedPlatform(a.platform); setShowPlatformWarning(true); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-colors ${
                    selectedPlatform === a.platform
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      : "bg-white/5 text-slate-500 border-white/10 hover:border-white/20"
                  }`}
                >
                  {platformLabels[a.platform] || a.platform}
                  {a.accountName && <span className="text-slate-600">({a.accountName})</span>}
                </button>
              ))}
            </div>
            {showPlatformWarning && selectedPlatform !== campaignPlatform && campaignPlatform && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <p>
                  This campaign was designed for <strong>{platformLabels[campaignPlatform] || campaignPlatform}</strong> but you&apos;re deploying to <strong>{platformLabels[selectedPlatform] || selectedPlatform}</strong>. The agent will adapt but some features may not transfer.
                </p>
              </div>
            )}
          </div>
        )}

      {/* Browser Deploy option (for platforms without API access like X) */}
      {["draft", "pending_approval", "approved", "failed"].includes(status) &&
        browserDeployPlatforms.includes(campaignPlatform || "") && (
          <div className="card p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
              Deploy via browser
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBrowserDeploy(campaignPlatform || "x")}
                disabled={!extensionDetected || browserDeployStatus === "deploying"}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition-colors disabled:opacity-50"
              >
                {browserDeployStatus === "deploying" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="h-3.5 w-3.5" />
                )}
                Deploy to {platformLabels[campaignPlatform || "x"] || "X"} via Browser
              </button>
              {browserDeployStatus === "queued" && (
                <span className="text-[10px] text-accent">Opening ads.x.com...</span>
              )}
              {browserDeployStatus === "success" && (
                <span className="text-[10px] text-emerald-400">Fields filled — review and submit on X</span>
              )}
              {browserDeployStatus === "failed" && (
                <span className="text-[10px] text-red-400">Browser deploy failed</span>
              )}
            </div>
            {!extensionDetected && (
              <p className="text-[10px] text-slate-500">
                Requires the{" "}
                <a href="/dashboard/connections" className="text-accent underline hover:text-accent/80">
                  Kalit Deploy extension
                </a>
                . Install it from Settings to deploy directly through the ad platform UI.
              </p>
            )}
            {extensionDetected && (
              <p className="text-[10px] text-slate-600">
                Opens {platformLabels[campaignPlatform || "x"]} in a new tab and auto-fills the campaign form. You review and submit.
              </p>
            )}
          </div>
        )}

      {/* No connected accounts warning */}
      {!hasConnectedAccounts &&
        !browserDeployPlatforms.includes(campaignPlatform || "") &&
        ["draft", "pending_approval", "approved", "failed"].includes(status) && (
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <p>
              No ad platform connected.{" "}
              <a
                href={`/dashboard/workspaces/${workspaceId}`}
                className="underline hover:text-yellow-300"
              >
                Connect Google or Meta
              </a>{" "}
              to launch campaigns.
            </p>
          </div>
        )}

      {/* Platform links (if already launched) */}
      {platformCampaignIds &&
        Object.keys(platformCampaignIds).length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-600 uppercase tracking-wider font-bold">
              Platform IDs:
            </span>
            {Object.entries(platformCampaignIds).map(([platform, id]) => (
              <a
                key={platform}
                href={platformLinks[platform] || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-accent transition-colors"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                {platform}: {id}
              </a>
            ))}
          </div>
        )}

      {/* Error display */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <p className="font-medium">Error</p>
          <p className="mt-1 text-red-400/80">{error}</p>
        </div>
      )}

      {/* Launch results */}
      {result && (
        <div className="space-y-2">
          {result.results?.map((r, i) => (
            <div
              key={i}
              className={`p-3 border text-xs ${
                r.success
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  {r.platform} — {r.success ? "Launched" : "Failed"}
                </p>
                {r.platformCampaignId && (
                  <span className="text-[10px] text-slate-500">
                    ID: {r.platformCampaignId}
                  </span>
                )}
              </div>
              {r.error && (
                <p className="mt-1 opacity-80">{r.error}</p>
              )}
              {r.steps.length > 0 && (
                <div className="mt-2 space-y-1">
                  {r.steps.map((step, j) => (
                    <div key={j} className="flex items-center gap-2 text-[10px]">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          step.status === "success"
                            ? "bg-emerald-400"
                            : step.status === "failed"
                              ? "bg-red-400"
                              : "bg-zinc-500"
                        }`}
                      />
                      <span className="text-slate-500">
                        {step.entity}
                        {step.platformId ? ` → ${step.platformId}` : ""}
                      </span>
                      {step.error && (
                        <span className="text-red-400/70">{step.error}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
