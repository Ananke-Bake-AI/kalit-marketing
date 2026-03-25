"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus } from "lucide-react";

const platformLabels: Record<string, string> = {
  google: "Google Ads",
  meta: "Meta Ads",
  tiktok: "TikTok",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  reddit: "Reddit",
};

const platformColors: Record<string, string> = {
  google: "bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25",
  meta: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/25",
  tiktok: "bg-pink-500/15 text-pink-400 border-pink-500/30 hover:bg-pink-500/25",
  x: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30 hover:bg-zinc-500/25",
  linkedin: "bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/25",
  reddit: "bg-orange-500/15 text-orange-400 border-orange-500/30 hover:bg-orange-500/25",
};

interface Props {
  campaignPlatform: string | null;
  workspaceId: string;
  campaignName: string;
  campaignObjective: string | null;
  campaignBudget: number | null;
}

export function CampaignPlatformAdapt({
  campaignPlatform,
  workspaceId,
  campaignName,
  campaignObjective,
  campaignBudget,
}: Props) {
  const [connectedPlatforms, setConnectedPlatforms] = useState<{ id: string; label: string }[]>([]);
  const [adapting, setAdapting] = useState<string | null>(null);
  const [adapted, setAdapted] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/platform-keys/connected")
      .then((r) => r.json())
      .then((data) => setConnectedPlatforms(data.connected || []))
      .catch(() => {});
  }, []);

  // Platforms that are connected but this campaign isn't created for
  const availablePlatforms = connectedPlatforms.filter(
    (p) => p.id !== campaignPlatform && !adapted.includes(p.id)
  );

  if (availablePlatforms.length === 0) return null;

  async function handleAdapt(platformId: string) {
    setAdapting(platformId);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/campaigns/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platformId,
          prompt: `Adapt the campaign "${campaignName}" for ${platformLabels[platformId] || platformId}. Objective: ${campaignObjective || "conversions"}. Daily budget: $${campaignBudget || 50}. Keep the same messaging angle and target audience but adapt the ad format, copy style, and targeting to match ${platformLabels[platformId] || platformId} best practices.`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdapted((prev) => [...prev, platformId]);
      } else {
        setError(data.error || "Failed to adapt campaign");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setAdapting(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-600">
          Adapt for:
        </span>
        {availablePlatforms.map((p) => (
          <button
            key={p.id}
            onClick={() => handleAdapt(p.id)}
            disabled={adapting !== null}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold border transition-colors cursor-pointer disabled:opacity-50 ${
              platformColors[p.id] || "bg-white/5 text-slate-400 border-white/10"
            }`}
          >
            {adapting === p.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            {p.label}
          </button>
        ))}
        {adapted.length > 0 && (
          <span className="text-[10px] text-emerald-400">
            Created — <a href="" onClick={(e) => { e.preventDefault(); window.location.reload(); }} className="underline">refresh</a> to see
          </span>
        )}
      </div>
      {error && (
        <p className="text-[10px] text-red-400">{error}</p>
      )}
      {adapting && (
        <p className="text-[10px] text-slate-500 animate-pulse">Generating {platformLabels[adapting]} campaign...</p>
      )}
    </div>
  );
}
