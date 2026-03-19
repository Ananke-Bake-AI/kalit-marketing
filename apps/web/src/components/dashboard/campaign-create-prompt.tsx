"use client";

import { useState, useRef } from "react";
import {
  Plus,
  Send,
  Loader2,
  X,
  Sparkles,
  Check,
  Globe,
  MessageSquare,
} from "lucide-react";

interface CampaignCreatePromptProps {
  workspaceId: string;
}

export function CampaignCreatePrompt({
  workspaceId,
}: CampaignCreatePromptProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"prompt" | "url">("prompt");
  const [prompt, setPrompt] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    campaignIds?: string[];
  } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function handleCreateFromPrompt() {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setResult(null);
    setStep("Generating campaign with AI...");

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/campaigns/create`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim() }),
        }
      );

      const data = await res.json();

      if (res.ok && data.success) {
        setResult({
          success: true,
          message: `Created "${data.campaign.name}" — ${data.campaign.adGroups} ad groups, ${data.campaign.totalAds} ads`,
          campaignIds: [data.campaign.id],
        });
        setPrompt("");
      } else {
        setResult({
          success: false,
          message: data.error || "Creation failed",
        });
      }
    } catch {
      setResult({
        success: false,
        message: "Network error",
      });
    } finally {
      setLoading(false);
      setStep("");
    }
  }

  async function handleCreateFromUrl() {
    if (!url.trim() || loading) return;

    setLoading(true);
    setResult(null);
    setStep("Analyzing website...");

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/pipeline/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim(), platform: "google" }),
        }
      );

      const data = await res.json();

      if (res.ok && data.success) {
        const ids = data.campaigns?.map(
          (c: { dbId: string }) => c.dbId
        ).filter(Boolean) ?? [];
        setResult({
          success: true,
          message: `Created ${data.summary.campaignsCreated} campaigns, ${data.summary.adGroupsCreated} ad groups, ${data.summary.creativesCreated} ads from ${url}`,
          campaignIds: ids,
        });
        setUrl("");
      } else {
        setResult({
          success: false,
          message: data.error || "Pipeline failed",
        });
      }
    } catch {
      setResult({
        success: false,
        message: "Network error",
      });
    } finally {
      setLoading(false);
      setStep("");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors cursor-pointer"
      >
        <Plus className="h-3.5 w-3.5" />
        Create Campaign
      </button>
    );
  }

  return (
    <div className="card border-accent/30 bg-accent/[0.03] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <p className="text-sm font-bold text-accent">Create Campaign</p>
        </div>
        <button
          onClick={() => {
            setOpen(false);
            setResult(null);
          }}
          className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1">
        <button
          onClick={() => setMode("prompt")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            mode === "prompt"
              ? "bg-accent/15 text-accent border border-accent/30"
              : "text-zinc-500 border border-white/5 hover:text-white"
          }`}
        >
          <MessageSquare className="h-3 w-3" />
          Describe it
        </button>
        <button
          onClick={() => setMode("url")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            mode === "url"
              ? "bg-accent/15 text-accent border border-accent/30"
              : "text-zinc-500 border border-white/5 hover:text-white"
          }`}
        >
          <Globe className="h-3 w-3" />
          From website URL
        </button>
      </div>

      {/* Prompt mode */}
      {mode === "prompt" && (
        <>
          <div className="relative">
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleCreateFromPrompt();
                }
              }}
              placeholder={"Describe the campaign you want to create...\n\ne.g. 'Create a Google Search campaign targeting SaaS founders looking for AI marketing tools. $50/day budget, focus on conversions. Include ad groups for competitor keywords, problem-aware searches, and solution-aware searches.'"}
              className="w-full bg-white/[0.03] border border-white/10 text-white text-sm p-3 pr-12 placeholder-zinc-600 focus:border-accent/50 focus:outline-none resize-none min-h-[120px]"
              disabled={loading}
            />
            <button
              onClick={handleCreateFromPrompt}
              disabled={!prompt.trim() || loading}
              className="absolute bottom-3 right-3 p-1.5 text-accent hover:text-accent/80 disabled:text-zinc-600 transition-colors cursor-pointer"
              title="Create (Cmd+Enter)"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Quick templates */}
          <div className="flex flex-wrap gap-1.5">
            {[
              "High-intent search campaign for conversions",
              "Competitor conquest campaign",
              "Brand awareness display campaign",
              "Retargeting campaign for cart abandoners",
              "B2B lead generation campaign",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setPrompt(suggestion);
                  inputRef.current?.focus();
                }}
                disabled={loading}
                className="px-2 py-1 text-[10px] bg-white/[0.03] border border-white/5 text-zinc-500 hover:text-accent hover:border-accent/30 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </>
      )}

      {/* URL mode */}
      {mode === "url" && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">
            Enter your website URL and AI will analyze it to create optimized campaigns with proper targeting, ad copy, and keywords.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFromUrl();
              }}
              placeholder="https://your-website.com"
              className="flex-1 bg-white/[0.03] border border-white/10 text-white text-sm px-3 py-2 placeholder-zinc-600 focus:border-accent/50 focus:outline-none"
              disabled={loading}
            />
            <button
              onClick={handleCreateFromUrl}
              disabled={!url.trim() || loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Generate
            </button>
          </div>
        </div>
      )}

      {/* Loading step */}
      {loading && step && (
        <div className="flex items-center gap-2 text-xs text-accent/70 animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>{step}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={`flex items-start gap-2 p-3 text-xs ${
            result.success
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {result.success ? (
            <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          ) : (
            <X className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          )}
          <div>
            <p>{result.message}</p>
            {result.success && result.campaignIds?.[0] && (
              <a
                href={`/dashboard/workspaces/${workspaceId}/campaigns/${result.campaignIds[0]}`}
                className="inline-flex items-center gap-1 mt-2 text-accent hover:underline"
              >
                View campaign →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
