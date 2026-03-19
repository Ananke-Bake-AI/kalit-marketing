"use client";

import { useState } from "react";
import Link from "next/link";
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
  Check,
  Loader2,
  Key,
  ExternalLink,
  ArrowRight,
  Plug,
} from "lucide-react";

interface ConnectPlatformsProps {
  workspaceId: string;
  connectedAccounts: Array<{
    id: string;
    platform: string;
    accountName: string | null;
    isActive: boolean;
  }>;
}

interface PlatformDef {
  key: string;
  name: string;
  icon: React.ElementType;
  category: string;
  authType: "oauth" | "apikey";
}

const platforms: PlatformDef[] = [
  { key: "meta", name: "Meta", icon: Globe, category: "Ad Platforms", authType: "oauth" },
  { key: "google", name: "Google", icon: Search, category: "Ad Platforms", authType: "oauth" },
  { key: "tiktok", name: "TikTok", icon: Music, category: "Ad Platforms", authType: "oauth" },
  { key: "x", name: "X (Twitter)", icon: AtSign, category: "Ad Platforms", authType: "oauth" },
  { key: "linkedin", name: "LinkedIn", icon: Briefcase, category: "Ad Platforms", authType: "oauth" },
  { key: "reddit", name: "Reddit", icon: MessageCircle, category: "Ad Platforms", authType: "oauth" },
  { key: "ga4", name: "Google Analytics", icon: BarChart3, category: "Analytics", authType: "apikey" },
  { key: "posthog", name: "PostHog", icon: BarChart3, category: "Analytics", authType: "apikey" },
  { key: "mixpanel", name: "Mixpanel", icon: BarChart3, category: "Analytics", authType: "apikey" },
  { key: "stripe", name: "Stripe", icon: CreditCard, category: "Revenue", authType: "apikey" },
  { key: "resend", name: "Resend", icon: Mail, category: "Email", authType: "apikey" },
  { key: "sendgrid", name: "SendGrid", icon: Send, category: "Email", authType: "apikey" },
  { key: "hubspot", name: "HubSpot", icon: Briefcase, category: "CRM", authType: "oauth" },
];

export function ConnectPlatforms({ workspaceId, connectedAccounts }: ConnectPlatformsProps) {
  const [apiKeyInput, setApiKeyInput] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectedSet = new Set(connectedAccounts.map((a) => a.platform));
  const categories = [...new Set(platforms.map((p) => p.category))];

  const handleOAuth = (platform: string) => {
    window.location.href = `/api/oauth/${platform}?workspaceId=${workspaceId}`;
  };

  const handleApiKey = async (platform: string) => {
    const apiKey = apiKeyInput[platform];
    if (!apiKey?.trim()) return;

    setConnecting(platform);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, apiKey }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Connection failed");
      }

      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Plug className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-100">
          Connect Platforms
        </h3>
        <span className="text-[10px] text-slate-600 ml-auto mr-2">
          {connectedAccounts.length} connected
        </span>
        <Link
          href="/dashboard/connections"
          className="inline-flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 transition-colors"
        >
          Full Setup Guide
          <ArrowRight className="h-2.5 w-2.5" />
        </Link>
      </div>

      {error && (
        <div className="mb-4 border border-red-500/30 bg-red-500/10 p-2.5">
          <p className="text-[11px] text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {categories.map((category) => (
          <div key={category}>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-2">
              {category}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {platforms
                .filter((p) => p.category === category)
                .map((p) => {
                  const Icon = p.icon;
                  const isConnected = connectedSet.has(p.key);
                  const account = connectedAccounts.find(
                    (a) => a.platform === p.key
                  );

                  return (
                    <div
                      key={p.key}
                      className={`flex items-center gap-3 border p-3 ${
                        isConnected
                          ? "border-emerald-500/20 bg-emerald-500/5"
                          : "border-white/5 bg-white/[0.02]"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          isConnected ? "text-emerald-400" : "text-slate-500"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs font-medium ${
                            isConnected ? "text-emerald-400" : "text-white"
                          }`}
                        >
                          {p.name}
                        </p>
                        {isConnected && account?.accountName && (
                          <p className="text-[10px] text-slate-500 truncate">
                            {account.accountName}
                          </p>
                        )}
                      </div>

                      {isConnected ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      ) : p.authType === "oauth" ? (
                        <button
                          onClick={() => handleOAuth(p.key)}
                          className="flex items-center gap-1 border border-white/10 px-2 py-1 text-[10px] text-slate-400 hover:border-accent/30 hover:text-accent transition-all"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          Connect
                        </button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input
                            type="password"
                            placeholder="API key"
                            value={apiKeyInput[p.key] ?? ""}
                            onChange={(e) =>
                              setApiKeyInput((prev) => ({
                                ...prev,
                                [p.key]: e.target.value,
                              }))
                            }
                            className="w-24 border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-white placeholder:text-slate-600 focus:border-accent/30 focus:outline-none"
                          />
                          <button
                            onClick={() => handleApiKey(p.key)}
                            disabled={
                              connecting === p.key ||
                              !apiKeyInput[p.key]?.trim()
                            }
                            className="border border-white/10 px-2 py-1 text-[10px] text-slate-400 hover:border-accent/30 hover:text-accent transition-all disabled:opacity-50"
                          >
                            {connecting === p.key ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <Key className="h-2.5 w-2.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
