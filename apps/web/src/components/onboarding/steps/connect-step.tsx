"use client";

import { useState } from "react";
import {
  Globe,
  Search,
  Music,
  AtSign,
  Briefcase,
  MessageCircle,
  BarChart3,
  CreditCard,
  Mail,
  Send,
  X,
  Check,
} from "lucide-react";
import { usePolling } from "@/hooks/use-polling";

interface ConnectStepProps {
  workspaceId: string;
  connectedAccounts: Array<{
    id: string;
    platform: string;
    accountName: string | null;
    isActive: boolean;
  }>;
  onComplete: () => void;
  onSkip: () => void;
}

interface PlatformDef {
  key: string;
  name: string;
  icon: React.ElementType;
  category: string;
  authType: "oauth" | "apikey";
}

const platforms: PlatformDef[] = [
  // Ad Platforms
  { key: "meta", name: "Meta", icon: Globe, category: "Ad Platforms", authType: "oauth" },
  { key: "google", name: "Google", icon: Search, category: "Ad Platforms", authType: "oauth" },
  { key: "tiktok", name: "TikTok", icon: Music, category: "Ad Platforms", authType: "oauth" },
  { key: "x", name: "X (Twitter)", icon: AtSign, category: "Ad Platforms", authType: "oauth" },
  { key: "linkedin", name: "LinkedIn", icon: Briefcase, category: "Ad Platforms", authType: "oauth" },
  { key: "reddit", name: "Reddit", icon: MessageCircle, category: "Ad Platforms", authType: "oauth" },
  // Analytics
  { key: "ga4", name: "Google Analytics", icon: BarChart3, category: "Analytics", authType: "apikey" },
  { key: "posthog", name: "PostHog", icon: BarChart3, category: "Analytics", authType: "apikey" },
  // Revenue
  { key: "stripe", name: "Stripe", icon: CreditCard, category: "Revenue", authType: "apikey" },
  // Email
  { key: "resend", name: "Resend", icon: Mail, category: "Email", authType: "apikey" },
  { key: "sendgrid", name: "SendGrid", icon: Send, category: "Email", authType: "apikey" },
];

const categories = ["Ad Platforms", "Analytics", "Revenue", "Email"];

interface WorkspacePollingData {
  connectedAccounts?: Array<{
    id: string;
    platform: string;
    accountName: string | null;
    isActive: boolean;
  }>;
}

export function ConnectStep({
  workspaceId,
  connectedAccounts: initialAccounts,
  onComplete,
  onSkip,
}: ConnectStepProps) {
  const [apiKeyModal, setApiKeyModal] = useState<string | null>(null);
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll for new connections (e.g. after OAuth redirect)
  const { data: polledData } = usePolling<WorkspacePollingData>(
    `/api/workspaces/${workspaceId}`,
    3000
  );

  const accounts =
    polledData?.connectedAccounts ?? initialAccounts;
  const connectedPlatforms = new Set(
    accounts.filter((a) => a.isActive).map((a) => a.platform)
  );
  const hasConnection = connectedPlatforms.size > 0;

  const handleOAuth = (platform: string) => {
    window.location.href = `/api/oauth/${platform}?workspaceId=${workspaceId}&returnTo=/dashboard/workspaces/${workspaceId}`;
  };

  const handleApiKeySubmit = async (platform: string) => {
    if (!apiKeyValue.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, apiKey: apiKeyValue.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to connect");
      }

      setApiKeyModal(null);
      setApiKeyValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-[-0.04em] text-text">
          Connect Your Platforms
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          Link your ad accounts, analytics, and revenue tools to enable
          autonomous growth.
        </p>
      </div>

      {categories.map((category) => {
        const categoryPlatforms = platforms.filter(
          (p) => p.category === category
        );
        return (
          <div key={category} className="mb-6">
            <p className="eyebrow mb-3">{category}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categoryPlatforms.map((platform) => {
                const Icon = platform.icon;
                const isConnected = connectedPlatforms.has(platform.key);
                const connectedAccount = accounts.find(
                  (a) => a.platform === platform.key && a.isActive
                );

                return (
                  <div
                    key={platform.key}
                    className={`flex items-center justify-between border p-4 transition-all ${
                      isConnected
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-divider bg-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`h-4 w-4 ${
                          isConnected ? "text-emerald-600" : "text-text-secondary"
                        }`}
                      />
                      <div>
                        <p className="text-xs font-medium text-text">
                          {platform.name}
                        </p>
                        {isConnected && (
                          <div className="mt-0.5 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            <span className="text-[10px] text-emerald-600">
                              {connectedAccount?.accountName || "Connected"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {isConnected ? (
                      <span className="badge bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                        <Check className="mr-1 h-2.5 w-2.5" />
                        Connected
                      </span>
                    ) : platform.authType === "oauth" ? (
                      <button
                        onClick={() => handleOAuth(platform.key)}
                        className="btn-secondary px-3 py-1 text-[10px]"
                      >
                        Connect
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setApiKeyModal(platform.key);
                          setApiKeyValue("");
                          setError(null);
                        }}
                        className="btn-secondary px-3 py-1 text-[10px]"
                      >
                        Add Key
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* API Key Modal */}
      {apiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="card-white w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">
                Connect{" "}
                {platforms.find((p) => p.key === apiKeyModal)?.name}
              </h3>
              <button
                onClick={() => setApiKeyModal(null)}
                className="text-text-secondary hover:text-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-text-secondary">
                API Key
              </label>
              <input
                type="password"
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
                placeholder="Enter your API key..."
                className="input mb-4 w-full"
              />
              {error && (
                <p className="mb-3 text-xs text-red-400">{error}</p>
              )}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setApiKeyModal(null)}
                  className="btn-secondary px-4 py-1.5 text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleApiKeySubmit(apiKeyModal)}
                  disabled={submitting || !apiKeyValue.trim()}
                  className="btn-primary px-4 py-1.5 text-xs disabled:opacity-50"
                >
                  {submitting ? "Connecting..." : "Connect"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={onSkip}
          className="text-xs text-text-secondary transition-colors hover:text-text-secondary"
        >
          Skip for now
        </button>
        <button
          onClick={onComplete}
          disabled={!hasConnection}
          className="btn-primary px-6 py-2 text-xs disabled:opacity-30"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
