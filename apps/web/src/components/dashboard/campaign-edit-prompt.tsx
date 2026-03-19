"use client";

import { useState, useRef } from "react";
import { Pencil, Send, Loader2, X, Sparkles, Check } from "lucide-react";

interface CampaignEditPromptProps {
  campaignId: string;
  workspaceId: string;
}

export function CampaignEditPrompt({
  campaignId,
  workspaceId,
}: CampaignEditPromptProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit() {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/campaigns/${campaignId}/edit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim() }),
        }
      );

      const data = await res.json();

      if (res.ok && data.success) {
        const syncInfo = data.platformSync
          ? `\nPlatform sync: ${(data.platformSync as string[]).join(", ")}`
          : "";
        setResult({
          success: true,
          message: `Updated "${data.campaign.name}" — ${data.campaign.adGroups} ad groups, ${data.campaign.totalAds} ads${syncInfo}`,
        });
        setPrompt("");
        // Reload page after a short delay to show updated campaign
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setResult({
          success: false,
          message: data.error || "Edit failed",
        });
      }
    } catch {
      setResult({
        success: false,
        message: "Network error — check if the dev server is running",
      });
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/25 transition-colors cursor-pointer"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit with AI
      </button>
    );
  }

  return (
    <div className="border border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-400">
            Edit Campaign with AI
          </p>
        </div>
        <button
          onClick={() => {
            setOpen(false);
            setResult(null);
          }}
          className="text-slate-500 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Prompt input */}
      <div className="relative">
        <textarea
          ref={inputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleSubmit();
            }
          }}
          placeholder="Describe what you want to change... e.g. 'Add a retargeting ad group for cart abandoners' or 'Make the tone more casual and add emoji to headlines' or 'Double the budget and add TikTok-specific ad copy'"
          className="w-full bg-white/[0.03] border border-white/10 text-white text-sm p-3 pr-12 placeholder-slate-600 focus:border-purple-500/50 focus:outline-none resize-none min-h-[80px]"
          disabled={loading}
        />
        <button
          onClick={handleSubmit}
          disabled={!prompt.trim() || loading}
          className="absolute bottom-3 right-3 p-1.5 text-purple-400 hover:text-purple-300 disabled:text-slate-600 transition-colors cursor-pointer"
          title="Send (Cmd+Enter)"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-purple-400/70 animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Claude is rewriting the campaign...</span>
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
          <p>{result.message}</p>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1.5">
        {[
          "Make headlines more aggressive",
          "Add a retargeting ad group",
          "Target younger audience (18-30)",
          "Double the daily budget",
          "Add more long-tail keywords",
          "Rewrite for B2B decision makers",
        ].map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => {
              setPrompt(suggestion);
              inputRef.current?.focus();
            }}
            disabled={loading}
            className="px-2 py-1 text-[10px] bg-white/[0.03] border border-white/5 text-slate-500 hover:text-purple-400 hover:border-purple-500/30 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
