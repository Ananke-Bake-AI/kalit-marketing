"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  PauseCircle,
  PlayCircle,
  DollarSign,
  Check,
  X,
  Loader2,
  Bot,
  Sparkles,
} from "lucide-react";

interface Recommendation {
  id: string;
  category: string;
  impact: string;
  title: string;
  description: string | null;
  reason: string | null;
  status: string;
  agentType: string | null;
  campaignId: string | null;
  createdAt: string;
  actionPayload: Record<string, unknown>;
  campaign?: { id: string; name: string; status: string } | null;
}

const CATEGORY_CONFIG: Record<
  string,
  { icon: typeof DollarSign; label: string; color: string }
> = {
  budget_change: {
    icon: DollarSign,
    label: "Budget Change",
    color: "text-amber-400",
  },
  campaign_pause: {
    icon: PauseCircle,
    label: "Pause Campaign",
    color: "text-red-400",
  },
  campaign_resume: {
    icon: PlayCircle,
    label: "Resume Campaign",
    color: "text-emerald-600",
  },
  bid_strategy_change: {
    icon: ArrowUpRight,
    label: "Bid Strategy",
    color: "text-blue-400",
  },
  budget_reallocation: {
    icon: ArrowDownRight,
    label: "Budget Reallocation",
    color: "text-purple-400",
  },
};

const IMPACT_STYLES: Record<string, string> = {
  high: "bg-red-500/15 text-red-400 border-red-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-zinc-500/15 text-text-secondary border-zinc-500/30",
};

export function RecommendationsPanel({
  workspaceId,
  campaignId,
}: {
  workspaceId: string;
  campaignId?: string;
}) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [history, setHistory] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "history">("pending");

  const fetchRecs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: "pending" });
      if (campaignId) params.set("campaignId", campaignId);

      const res = await fetch(
        `/api/workspaces/${workspaceId}/recommendations?${params}`
      );
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [workspaceId, campaignId]);

  const fetchHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (campaignId) params.set("campaignId", campaignId);

      const res = await fetch(
        `/api/workspaces/${workspaceId}/recommendations?${params}`
      );
      if (res.ok) {
        const data = await res.json();
        setHistory(
          (data.recommendations ?? []).filter(
            (r: Recommendation) => r.status !== "pending"
          )
        );
      }
    } catch {
      // silently fail
    }
  }, [workspaceId, campaignId]);

  useEffect(() => {
    fetchRecs();
    fetchHistory();
  }, [fetchRecs, fetchHistory]);

  async function handleAction(recId: string, action: "approve" | "dismiss") {
    setActionLoading(recId);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/recommendations/${recId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      if (res.ok) {
        // Remove from pending, refresh history
        setRecommendations((prev) => prev.filter((r) => r.id !== recId));
        fetchHistory();
      }
    } catch {
      // silently fail
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-2 text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading recommendations...</span>
        </div>
      </div>
    );
  }

  if (recommendations.length === 0 && history.length === 0) return null;

  const STATUS_BADGE: Record<string, string> = {
    applied: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    dismissed: "bg-zinc-500/15 text-text-secondary border-zinc-500/30",
    failed: "bg-red-500/15 text-red-400 border-red-500/30",
    approved: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  };

  const activeList = tab === "pending" ? recommendations : history;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="border-b border-divider px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center bg-[#6366F1]/10">
            <Sparkles className="h-4 w-4 text-[#6366F1]" />
          </div>
          <div>
            <p className="eyebrow text-[#6366F1]">AI Recommendations</p>
            <p className="text-xs text-text-secondary mt-0.5">
              {recommendations.length} pending
              {history.length > 0 ? ` · ${history.length} resolved` : ""}
            </p>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setTab("pending")}
            className={`px-3 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors ${
              tab === "pending"
                ? "bg-[#6366F1]/15 text-[#6366F1] border border-[#6366F1]/30"
                : "text-text-secondary border border-divider hover:text-text"
            }`}
          >
            Pending ({recommendations.length})
          </button>
          <button
            onClick={() => setTab("history")}
            className={`px-3 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors ${
              tab === "history"
                ? "bg-subtle-strong text-text border border-divider"
                : "text-text-secondary border border-divider hover:text-text"
            }`}
          >
            History ({history.length})
          </button>
        </div>
      </div>

      {/* Empty state for current tab */}
      {activeList.length === 0 && (
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-text-secondary">
            {tab === "pending"
              ? "No pending recommendations"
              : "No resolved recommendations yet"}
          </p>
        </div>
      )}

      {/* List */}
      <div className="divide-y divide-white/5">
        {activeList.map((rec) => {
          const config = CATEGORY_CONFIG[rec.category] ?? {
            icon: AlertTriangle,
            label: rec.category,
            color: "text-text-secondary",
          };
          const Icon = config.icon;
          const isLoading = actionLoading === rec.id;

          return (
            <div
              key={rec.id}
              className="px-6 py-4 flex items-start gap-4 hover:bg-transparent transition-colors"
            >
              {/* Icon */}
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center bg-subtle ${config.color}`}
              >
                <Icon className="h-4 w-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border ${IMPACT_STYLES[rec.impact] ?? IMPACT_STYLES.medium}`}
                  >
                    {rec.impact}
                  </span>
                  <span className="text-[10px] text-text-secondary uppercase tracking-wider">
                    {config.label}
                  </span>
                </div>

                <p className="text-sm font-medium text-text">
                  {rec.title}
                </p>

                {rec.reason && (
                  <p className="text-xs text-text-secondary mt-1 flex items-start gap-1.5">
                    <Bot className="h-3 w-3 mt-0.5 shrink-0 text-text-secondary" />
                    {rec.reason}
                  </p>
                )}

                {rec.campaign && (
                  <p className="text-[10px] text-text-secondary mt-1">
                    Campaign: {rec.campaign.name}
                  </p>
                )}
              </div>

              {/* Actions (pending) or Status badge (history) */}
              <div className="flex items-center gap-2 shrink-0">
                {tab === "pending" ? (
                  <>
                    <button
                      onClick={() => handleAction(rec.id, "approve")}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Apply
                    </button>
                    <button
                      onClick={() => handleAction(rec.id, "dismiss")}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-red-400 border border-divider hover:border-red-500/30 transition-colors disabled:opacity-50"
                    >
                      <X className="h-3 w-3" />
                      Dismiss
                    </button>
                  </>
                ) : (
                  <span
                    className={`inline-flex items-center px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider border ${STATUS_BADGE[rec.status] ?? STATUS_BADGE.dismissed}`}
                  >
                    {rec.status}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
