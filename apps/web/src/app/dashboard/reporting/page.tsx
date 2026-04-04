"use client";

import { useEffect, useState } from "react";

interface GrowthReport {
  workspace: { id: string; name: string; status: string };
  period: { start: string; end: string };
  measurementConfidence: {
    overall: number;
    factors: Record<string, number>;
  };
  performance: {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalRevenue: number;
    avgCtr: number | null;
    avgCpc: number | null;
    avgCpa: number | null;
    roas: number | null;
  };
  campaigns: {
    id: string;
    name: string;
    type: string;
    status: string;
    spend: number;
    conversions: number;
    revenue: number;
    cpa: number | null;
    roas: number | null;
  }[];
  actions: {
    timestamp: string;
    type: string;
    description: string;
    reason: string;
  }[];
  experiments: {
    id: string;
    name: string;
    status: string;
    hypothesis: string;
    winner: string | null;
    confidence: number | null;
  }[];
  memoriesGained: number;
  tasksCompleted: number;
  tasksFailed: number;
}

interface Workspace {
  id: string;
  name: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function confidenceColor(score: number): string {
  if (score >= 0.8) return "text-emerald-600";
  if (score >= 0.5) return "text-yellow-400";
  return "text-red-400";
}

function confidenceBarColor(score: number): string {
  if (score >= 0.8) return "bg-emerald-500";
  if (score >= 0.5) return "bg-yellow-500";
  return "bg-red-500";
}

export default function ReportingPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [report, setReport] = useState<GrowthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"7d" | "14d" | "30d">("7d");

  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data) => {
        setWorkspaces(data);
        if (data.length > 0) setSelectedWorkspace(data[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedWorkspace) return;
    setLoading(true);
    const days = dateRange === "7d" ? 7 : dateRange === "14d" ? 14 : 30;
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const params = new URLSearchParams({
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    });
    fetch(`/api/workspaces/${selectedWorkspace}/reporting?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedWorkspace, dateRange]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text font-sans">
            Growth Report
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Performance, actions, and learning
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex border border-divider rounded-none overflow-hidden">
            {(["7d", "14d", "30d"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  dateRange === range
                    ? "bg-accent/10 text-accent"
                    : "bg-surface shadow-card rounded-3xl text-text-secondary hover:text-text"
                }`}
              >
                {range}
              </button>
            ))}
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
      </div>

      {loading ? (
        <div className="card p-12 text-center">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-text-secondary mt-3">Generating report...</p>
        </div>
      ) : !report ? (
        <div className="card p-12 text-center">
          <p className="text-text-secondary">No report data available</p>
        </div>
      ) : (
        <>
          {/* Measurement Confidence */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text uppercase tracking-wider">
                Measurement Confidence
              </h2>
              <span
                className={`text-2xl font-bold ${confidenceColor(report.measurementConfidence.overall)}`}
              >
                {formatPercent(report.measurementConfidence.overall)}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(report.measurementConfidence.factors).map(
                ([factor, score]) => (
                  <div key={factor}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-secondary capitalize">
                        {factor.replace(/_/g, " ")}
                      </span>
                      <span
                        className={`text-xs font-medium ${confidenceColor(score)}`}
                      >
                        {formatPercent(score)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-subtle rounded-none overflow-hidden">
                      <div
                        className={`h-full ${confidenceBarColor(score)} transition-all`}
                        style={{ width: `${score * 100}%` }}
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Performance Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Spend",
                value: formatCurrency(report.performance.totalSpend),
              },
              {
                label: "Revenue",
                value: formatCurrency(report.performance.totalRevenue),
                highlight: report.performance.totalRevenue > 0,
              },
              {
                label: "ROAS",
                value: report.performance.roas
                  ? `${report.performance.roas.toFixed(2)}x`
                  : "—",
                highlight:
                  report.performance.roas !== null &&
                  report.performance.roas >= 2,
              },
              {
                label: "Conversions",
                value: formatNumber(report.performance.totalConversions),
              },
              {
                label: "Impressions",
                value: formatNumber(report.performance.totalImpressions),
              },
              {
                label: "CTR",
                value: report.performance.avgCtr
                  ? formatPercent(report.performance.avgCtr)
                  : "—",
              },
              {
                label: "CPC",
                value: report.performance.avgCpc
                  ? formatCurrency(report.performance.avgCpc)
                  : "—",
              },
              {
                label: "CPA",
                value: report.performance.avgCpa
                  ? formatCurrency(report.performance.avgCpa)
                  : "—",
              },
            ].map((stat) => (
              <div key={stat.label} className="card p-4">
                <p className="text-xs text-text-secondary uppercase tracking-wider">
                  {stat.label}
                </p>
                <p
                  className={`text-xl font-bold mt-1 ${
                    "highlight" in stat && stat.highlight
                      ? "text-accent"
                      : "text-text"
                  }`}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Two Column: Actions + Experiments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Agent Actions */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-4">
                System Actions
              </h2>
              {report.actions.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  No actions in this period
                </p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {report.actions.map((action, i) => (
                    <div
                      key={i}
                      className="border-l-2 border-accent/30 pl-3 py-1"
                    >
                      <p className="text-sm text-text">
                        {action.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-text-secondary">
                          {new Date(action.timestamp).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-text-secondary italic">
                          {action.reason}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Experiments */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-4">
                Experiments
              </h2>
              {report.experiments.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  No experiments in this period
                </p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {report.experiments.map((exp) => (
                    <div key={exp.id} className="p-3 bg-transparent border border-divider">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-text">
                          {exp.name}
                        </p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-none ${
                            exp.status === "running"
                              ? "bg-blue-500/20 text-blue-400"
                              : exp.status === "completed"
                                ? "bg-emerald-500/20 text-emerald-600"
                                : "bg-zinc-500/20 text-text-secondary"
                          }`}
                        >
                          {exp.status}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">
                        {exp.hypothesis}
                      </p>
                      {exp.winner && (
                        <p className="text-xs text-accent mt-1">
                          Winner: {exp.winner} (
                          {exp.confidence
                            ? formatPercent(exp.confidence)
                            : "—"}{" "}
                          confidence)
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Learning Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4 text-center">
              <p className="text-3xl font-bold text-accent">
                {report.tasksCompleted}
              </p>
              <p className="text-xs text-text-secondary mt-1 uppercase tracking-wider">
                Tasks Completed
              </p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-3xl font-bold text-text">
                {report.memoriesGained}
              </p>
              <p className="text-xs text-text-secondary mt-1 uppercase tracking-wider">
                Memories Gained
              </p>
            </div>
            <div className="card p-4 text-center">
              <p
                className={`text-3xl font-bold ${report.tasksFailed > 0 ? "text-red-400" : "text-text-secondary"}`}
              >
                {report.tasksFailed}
              </p>
              <p className="text-xs text-text-secondary mt-1 uppercase tracking-wider">
                Tasks Failed
              </p>
            </div>
          </div>

          {/* Top Campaigns */}
          {report.campaigns.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-4">
                Top Campaigns by Spend
              </h2>
              <div className="space-y-2">
                {report.campaigns.slice(0, 8).map((c) => {
                  const maxSpend = Math.max(
                    ...report.campaigns.map((x) => x.spend),
                    1
                  );
                  return (
                    <div key={c.id} className="relative">
                      <div
                        className="absolute inset-y-0 left-0 bg-accent/5"
                        style={{
                          width: `${(c.spend / maxSpend) * 100}%`,
                        }}
                      />
                      <div className="relative flex items-center justify-between p-2.5">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-text font-medium">
                            {c.name}
                          </span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-none ${
                              c.status === "active"
                                ? "bg-emerald-500/20 text-emerald-600"
                                : "bg-zinc-500/20 text-text-secondary"
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-text-secondary">
                            {formatCurrency(c.spend)}
                          </span>
                          <span className="text-text-secondary">
                            {c.conversions} conv
                          </span>
                          <span
                            className={
                              c.roas && c.roas >= 2
                                ? "text-accent font-medium"
                                : "text-text-secondary"
                            }
                          >
                            {c.roas ? `${c.roas.toFixed(2)}x` : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
