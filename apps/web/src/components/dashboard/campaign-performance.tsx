"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Calendar,
  Loader2,
  BarChart3,
  TrendingUp,
  AlertCircle,
  Clock,
  Eye,
  MousePointerClick,
  Target,
  DollarSign,
  ArrowUpRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CampaignPerformanceProps {
  workspaceId: string;
  campaignId: string;
}

interface DailyMetric {
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  spend: number;
  cpa: number;
  roas: number;
}

interface ReportingResponse {
  metrics?: DailyMetric[];
  summary?: {
    totalImpressions: number;
    totalClicks: number;
    avgCtr: number;
    totalConversions: number;
    totalSpend: number;
    avgCpa: number;
    avgRoas: number;
  };
  lastSyncedAt?: string;
}

type DateRange = "7d" | "14d" | "30d";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Number.isFinite(n) && !Number.isInteger(n)) return n.toFixed(2);
  return n.toString();
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDateRange(range: DateRange): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  const days = range === "7d" ? 7 : range === "14d" ? 14 : 30;
  start.setDate(start.getDate() - days);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-accent">{icon}</span>
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">
        {label}
      </span>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="border border-divider bg-transparent p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-text-secondary">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">
          {label}
        </span>
      </div>
      <span
        className={
          highlight
            ? "text-lg font-bold font-mono text-accent"
            : "text-lg font-bold font-mono text-text"
        }
      >
        {value}
      </span>
      {sub && <span className="text-[10px] text-text-secondary">{sub}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mini CSS bar chart                                                 */
/* ------------------------------------------------------------------ */

function MiniBarChart({ metrics }: { metrics: DailyMetric[] }) {
  const maxSpend = Math.max(...metrics.map((m) => m.spend), 1);
  const maxConv = Math.max(...metrics.map((m) => m.conversions), 1);

  return (
    <div className="card p-5">
      <SectionHeader
        icon={<BarChart3 className="w-4 h-4" />}
        label="Daily Spend & Conversions"
      />

      <div className="flex items-center gap-4 mb-4 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-accent/60" />
          <span className="text-text-secondary">Spend</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-emerald-500/60" />
          <span className="text-text-secondary">Conversions</span>
        </div>
      </div>

      <div className="flex items-end gap-1" style={{ height: 120 }}>
        {metrics.map((m) => {
          const spendH = Math.max((m.spend / maxSpend) * 100, 2);
          const convH = Math.max((m.conversions / maxConv) * 100, 2);

          return (
            <div
              key={m.date}
              className="flex-1 flex items-end gap-[1px] group relative"
              style={{ height: "100%" }}
            >
              {/* Spend bar */}
              <div
                className="flex-1 bg-accent/40 hover:bg-accent/60 transition-colors"
                style={{ height: `${spendH}%` }}
              />
              {/* Conversions bar */}
              <div
                className="flex-1 bg-emerald-500/40 hover:bg-emerald-500/60 transition-colors"
                style={{ height: `${convH}%` }}
              />

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                <div className="bg-[#0a0f2e] border border-divider p-2 text-[10px] whitespace-nowrap">
                  <p className="text-text font-medium mb-1">
                    {formatDate(m.date)}
                  </p>
                  <p className="text-accent">
                    Spend: {formatCurrency(m.spend)}
                  </p>
                  <p className="text-emerald-600">
                    Conv: {formatNumber(m.conversions)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex gap-1 mt-1">
        {metrics.map((m, i) => {
          // Show label for first, last, and every ~5th bar
          const show =
            i === 0 ||
            i === metrics.length - 1 ||
            (metrics.length > 10 && i % 5 === 0) ||
            metrics.length <= 10;
          return (
            <div
              key={m.date}
              className="flex-1 text-center text-[8px] text-text-secondary font-mono"
            >
              {show ? formatDate(m.date) : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function CampaignPerformance({
  workspaceId,
  campaignId,
}: CampaignPerformanceProps) {
  const [range, setRange] = useState<DateRange>("7d");
  const [data, setData] = useState<ReportingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { start, end } = getDateRange(range);
      const res = await fetch(
        `/api/workspaces/${workspaceId}/reporting?campaignId=${campaignId}&start=${start}&end=${end}`
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed to fetch reporting data (${res.status})`);
        setData(null);
        return;
      }

      const json: ReportingResponse = await res.json();
      setData(json);

      if (json.lastSyncedAt) {
        setLastSynced(json.lastSyncedAt);
      }
    } catch {
      setError("Network error — could not fetch performance data");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, campaignId, range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSync() {
    setSyncing(true);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Sync failed");
        return;
      }

      setLastSynced(new Date().toISOString());
      // Re-fetch data after sync
      await fetchData();
    } catch {
      setError("Network error during sync");
    } finally {
      setSyncing(false);
    }
  }

  const metrics = data?.metrics ?? [];
  const summary = data?.summary;
  const hasData = metrics.length > 0;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-5">
      {/* ============================================================ */}
      {/*  HEADER: Date range + Sync                                   */}
      {/* ============================================================ */}
      <div className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-accent">
              <TrendingUp className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">
              Campaign Performance
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Date range selector */}
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-text-secondary" />
              {(["7d", "14d", "30d"] as DateRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    range === r
                      ? "bg-accent/15 text-accent border border-accent/30"
                      : "text-text-secondary border border-divider hover:text-text hover:border-divider"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Sync button */}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors disabled:opacity-50"
            >
              {syncing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Sync Now
            </button>
          </div>
        </div>

        {/* Last synced */}
        {lastSynced && (
          <div className="flex items-center gap-1.5 mt-3 text-[10px] text-text-secondary">
            <Clock className="w-3 h-3" />
            Last synced: {formatTimestamp(lastSynced)}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/*  Error state                                                  */}
      {/* ============================================================ */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* ============================================================ */}
      {/*  Loading state                                                */}
      {/* ============================================================ */}
      {loading && (
        <div className="card p-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-accent animate-spin" />
          <span className="text-xs text-text-secondary">
            Loading performance data...
          </span>
        </div>
      )}

      {/* ============================================================ */}
      {/*  Empty state                                                  */}
      {/* ============================================================ */}
      {!loading && !hasData && !error && (
        <div className="card p-12 flex flex-col items-center justify-center gap-3">
          <BarChart3 className="w-6 h-6 text-text-secondary" />
          <span className="text-sm text-text-secondary font-medium">
            No performance data yet
          </span>
          <span className="text-[10px] text-text-secondary max-w-xs text-center leading-relaxed">
            Data will appear after the campaign starts receiving impressions.
            Try syncing to pull the latest data from the ad platform.
          </span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Sync Now
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/*  Summary cards                                                */}
      {/* ============================================================ */}
      {!loading && hasData && summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard
            icon={<Eye className="w-3 h-3" />}
            label="Impressions"
            value={formatNumber(summary.totalImpressions)}
            sub={`${formatNumber(summary.totalImpressions / metrics.length)}/day avg`}
          />
          <SummaryCard
            icon={<MousePointerClick className="w-3 h-3" />}
            label="Clicks"
            value={formatNumber(summary.totalClicks)}
            sub={`CTR ${formatPct(summary.avgCtr)}`}
          />
          <SummaryCard
            icon={<Target className="w-3 h-3" />}
            label="Conversions"
            value={formatNumber(summary.totalConversions)}
            sub={`CPA ${formatCurrency(summary.avgCpa)}`}
            highlight={summary.totalConversions > 0}
          />
          <SummaryCard
            icon={<DollarSign className="w-3 h-3" />}
            label="Spend"
            value={formatCurrency(summary.totalSpend)}
            sub={`ROAS ${summary.avgRoas.toFixed(2)}x`}
            highlight={summary.avgRoas >= 1}
          />
        </div>
      )}

      {/* ============================================================ */}
      {/*  Mini bar chart                                               */}
      {/* ============================================================ */}
      {!loading && hasData && <MiniBarChart metrics={metrics} />}

      {/* ============================================================ */}
      {/*  Daily metrics table                                          */}
      {/* ============================================================ */}
      {!loading && hasData && (
        <div className="card p-5">
          <SectionHeader
            icon={<ArrowUpRight className="w-4 h-4" />}
            label="Daily Breakdown"
          />

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-divider">
                  {[
                    "Date",
                    "Impressions",
                    "Clicks",
                    "CTR",
                    "Conversions",
                    "Spend",
                    "CPA",
                    "ROAS",
                  ].map((col) => (
                    <th
                      key={col}
                      className="text-left text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary py-2 px-3 first:pl-0"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((m, i) => (
                  <tr
                    key={m.date}
                    className={`border-b border-white/[0.03] hover:bg-transparent transition-colors ${
                      i % 2 === 0 ? "bg-white/[0.005]" : ""
                    }`}
                  >
                    <td className="py-2.5 px-3 pl-0 font-mono text-text whitespace-nowrap">
                      {formatDate(m.date)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-text">
                      {formatNumber(m.impressions)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-text">
                      {formatNumber(m.clicks)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-text">
                      {formatPct(m.ctr)}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      <span
                        className={
                          m.conversions > 0 ? "text-accent font-bold" : "text-text-secondary"
                        }
                      >
                        {formatNumber(m.conversions)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-text">
                      {formatCurrency(m.spend)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-text">
                      {m.conversions > 0 ? formatCurrency(m.cpa) : "--"}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      <span
                        className={
                          m.roas >= 1
                            ? "text-accent font-bold"
                            : m.roas > 0
                              ? "text-text"
                              : "text-text-secondary"
                        }
                      >
                        {m.roas > 0 ? `${m.roas.toFixed(2)}x` : "--"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
