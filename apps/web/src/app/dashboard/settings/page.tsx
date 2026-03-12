"use client";

import { useEffect, useState } from "react";

interface ConnectedAccount {
  id: string;
  platform: string;
  accountName: string | null;
  isActive: boolean;
  lastSyncAt: string | null;
}

interface WorkspaceConfig {
  productName: string;
  productDescription: string;
  productUrl: string | null;
  industry: string | null;
  stage: string | null;
  icpDescription: string | null;
  brandVoice: string | null;
  monthlyBudget: number | null;
  targetCac: number | null;
  targetRoas: number | null;
  currency: string;
  autonomyMode: string;
  targetGeographies: string[];
}

interface WorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  config: WorkspaceConfig | null;
  connectedAccounts: ConnectedAccount[];
}

interface Workspace {
  id: string;
  name: string;
}

const autonomyConfig: Record<string, { label: string; color: string; description: string }> = {
  draft: {
    label: "Draft",
    color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    description: "All actions saved as drafts for manual review",
  },
  approval: {
    label: "Approval",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    description: "Actions require explicit approval before execution",
  },
  guardrailed: {
    label: "Guardrailed",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    description: "Autonomous within policy rules, escalates on boundaries",
  },
  autonomous: {
    label: "Autonomous",
    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    description: "Full autonomy with monitoring and alerting",
  },
};

const platformLabels: Record<string, string> = {
  meta: "Meta (Facebook/Instagram)",
  google: "Google Ads",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  x: "X (Twitter)",
  reddit: "Reddit",
  youtube: "YouTube",
  ga4: "Google Analytics 4",
  search_console: "Search Console",
  hubspot: "HubSpot",
  salesforce: "Salesforce",
  mailchimp: "Mailchimp",
  sendgrid: "SendGrid",
  stripe: "Stripe",
  custom: "Custom",
};

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SettingsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data) => {
        setWorkspaces(data);
        if (data.length > 0) {
          setSelectedWorkspace(data[0].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedWorkspace) return;
    setLoading(true);
    fetch(`/api/workspaces/${selectedWorkspace}`)
      .then((r) => r.json())
      .then((data) => {
        setWorkspace(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedWorkspace]);

  const config = workspace?.config;
  const autonomy = config
    ? autonomyConfig[config.autonomyMode] || autonomyConfig.draft
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-sans">Settings</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Workspace configuration and connected platforms
          </p>
        </div>

        <select
          value={selectedWorkspace}
          onChange={(e) => setSelectedWorkspace(e.target.value)}
          className="input text-sm w-56"
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="card p-12 text-center">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-zinc-500 mt-3">Loading settings...</p>
        </div>
      ) : !config ? (
        <div className="card p-12 text-center">
          <p className="text-zinc-500">No configuration found</p>
          <p className="text-xs text-zinc-600 mt-1">
            Complete the onboarding wizard to configure this workspace
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Product Info */}
          <div className="card p-5 space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium eyebrow">
              Product
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-zinc-600 mb-0.5">Name</p>
                <p className="text-white font-medium">{config.productName}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-600 mb-0.5">Description</p>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {config.productDescription}
                </p>
              </div>
              {config.productUrl && (
                <div>
                  <p className="text-xs text-zinc-600 mb-0.5">URL</p>
                  <p className="text-sm text-accent font-mono">
                    {config.productUrl}
                  </p>
                </div>
              )}
              <div className="flex gap-6">
                {config.industry && (
                  <div>
                    <p className="text-xs text-zinc-600 mb-0.5">Industry</p>
                    <p className="text-sm text-zinc-300">{config.industry}</p>
                  </div>
                )}
                {config.stage && (
                  <div>
                    <p className="text-xs text-zinc-600 mb-0.5">Stage</p>
                    <p className="text-sm text-zinc-300 capitalize">
                      {config.stage}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Budget */}
          <div className="card p-5 space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium eyebrow">
              Budget & Targets
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-600 mb-0.5">Monthly Budget</p>
                  <p className="text-xl text-white font-bold">
                    {config.monthlyBudget
                      ? formatCurrency(config.monthlyBudget, config.currency)
                      : "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-600 mb-0.5">Currency</p>
                  <p className="text-sm text-zinc-300 font-mono">
                    {config.currency}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-600 mb-0.5">Target CAC</p>
                  <p className="text-white font-medium">
                    {config.targetCac
                      ? formatCurrency(config.targetCac, config.currency)
                      : "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-600 mb-0.5">Target ROAS</p>
                  <p className="text-white font-medium">
                    {config.targetRoas
                      ? `${config.targetRoas.toFixed(2)}x`
                      : "Not set"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ICP */}
          <div className="card p-5 space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium eyebrow">
              Ideal Customer Profile
            </p>
            {config.icpDescription ? (
              <p className="text-sm text-zinc-300 leading-relaxed">
                {config.icpDescription}
              </p>
            ) : (
              <p className="text-sm text-zinc-600">Not configured</p>
            )}
          </div>

          {/* Brand Voice */}
          <div className="card p-5 space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium eyebrow">
              Brand Voice
            </p>
            {config.brandVoice ? (
              <p className="text-sm text-zinc-300 leading-relaxed">
                {config.brandVoice}
              </p>
            ) : (
              <p className="text-sm text-zinc-600">Not configured</p>
            )}
          </div>

          {/* Autonomy Mode */}
          <div className="card p-5 space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium eyebrow">
              Autonomy Mode
            </p>
            {autonomy && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block px-3 py-1 text-sm font-medium rounded-none border ${autonomy.color}`}
                  >
                    {autonomy.label}
                  </span>
                </div>
                <p className="text-sm text-zinc-400">{autonomy.description}</p>

                {/* Visual autonomy scale */}
                <div className="flex gap-1 mt-2">
                  {(["draft", "approval", "guardrailed", "autonomous"] as const).map(
                    (level) => (
                      <div
                        key={level}
                        className={`flex-1 h-2 rounded-none ${
                          config.autonomyMode === level
                            ? level === "draft"
                              ? "bg-zinc-500"
                              : level === "approval"
                                ? "bg-yellow-500"
                                : level === "guardrailed"
                                  ? "bg-blue-500"
                                  : "bg-emerald-500"
                            : Object.keys(autonomyConfig).indexOf(level) <=
                                Object.keys(autonomyConfig).indexOf(
                                  config.autonomyMode
                                )
                              ? "bg-white/10"
                              : "bg-white/5"
                        }`}
                      />
                    )
                  )}
                </div>
                <div className="flex justify-between text-[10px] text-zinc-600">
                  <span>Draft</span>
                  <span>Approval</span>
                  <span>Guardrailed</span>
                  <span>Autonomous</span>
                </div>
              </div>
            )}
          </div>

          {/* Target Geographies */}
          <div className="card p-5 space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium eyebrow">
              Target Geographies
            </p>
            {config.targetGeographies.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {config.targetGeographies.map((geo) => (
                  <span
                    key={geo}
                    className="px-2 py-1 text-xs bg-white/5 text-zinc-300 rounded-none border border-white/5"
                  >
                    {geo}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-600">No geographies configured</p>
            )}
          </div>

          {/* Connected Platforms — full width */}
          <div className="card p-5 space-y-4 lg:col-span-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium eyebrow">
              Connected Platforms
            </p>
            {workspace?.connectedAccounts &&
            workspace.connectedAccounts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {workspace.connectedAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">
                        {platformLabels[acc.platform] || acc.platform}
                      </p>
                      {acc.accountName && (
                        <p className="text-xs text-zinc-500 truncate">
                          {acc.accountName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {acc.lastSyncAt && (
                        <span className="text-[10px] text-zinc-600">
                          Synced{" "}
                          {new Date(acc.lastSyncAt).toLocaleDateString()}
                        </span>
                      )}
                      <span
                        className={`w-2 h-2 rounded-full ${
                          acc.isActive ? "bg-emerald-500" : "bg-zinc-600"
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-600">
                No platforms connected yet
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
