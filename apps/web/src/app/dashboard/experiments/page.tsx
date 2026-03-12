"use client";

import { useEffect, useState } from "react";

interface Experiment {
  id: string;
  name: string;
  status: string;
  hypothesis: string;
  successMetric: string;
  targetConfidence: number;
  confidence: number | null;
  winnerVariant: string | null;
  learnings: string | null;
  outcome: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface Workspace {
  id: string;
  name: string;
}

const statusColors: Record<string, string> = {
  planned: "bg-zinc-500/20 text-zinc-400",
  running: "bg-blue-500/20 text-blue-400",
  completed: "bg-emerald-500/20 text-emerald-400",
  inconclusive: "bg-yellow-500/20 text-yellow-400",
  cancelled: "bg-red-500/20 text-red-400",
};

export default function ExperimentsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

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
    fetch(`/api/workspaces/${selectedWorkspace}/experiments`)
      .then((r) => r.json())
      .then((data) => {
        setExperiments(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedWorkspace]);

  const filtered =
    filter === "all"
      ? experiments
      : experiments.filter((e) => e.status === filter);

  const statuses = ["all", "running", "planned", "completed", "inconclusive", "cancelled"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-sans">
            Experiments
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            A/B tests, hypothesis validation, and experiment results
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

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-none border transition-colors ${
              filter === s
                ? "bg-accent/10 border-accent text-accent"
                : "bg-card border-white/5 text-zinc-400 hover:border-white/10"
            }`}
          >
            {s === "all" ? "All" : s.replace("_", " ")}
            {s !== "all" && (
              <span className="ml-1 text-zinc-600">
                ({experiments.filter((e) => e.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Experiment Cards */}
      {loading ? (
        <div className="card p-12 text-center">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-zinc-500 mt-3">Loading experiments...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-zinc-500">No experiments found</p>
          <p className="text-xs text-zinc-600 mt-1">
            Experiments will appear once the system begins hypothesis testing
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((exp) => (
            <div key={exp.id} className="card p-5 space-y-4">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-white font-medium truncate">
                      {exp.name}
                    </h3>
                    {/* Pulsing indicator for running experiments */}
                    {exp.status === "running" && (
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5 font-mono">
                    {exp.id}
                  </p>
                </div>
                <span
                  className={`inline-block px-2 py-0.5 text-xs font-medium rounded-none shrink-0 ${
                    statusColors[exp.status] || "bg-zinc-500/20 text-zinc-400"
                  }`}
                >
                  {exp.status}
                </span>
              </div>

              {/* Hypothesis */}
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                  Hypothesis
                </p>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {exp.hypothesis}
                </p>
              </div>

              {/* Success Metric + Confidence */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                    Success Metric
                  </p>
                  <p className="text-sm text-white font-medium">
                    {exp.successMetric.replace(/_/g, " ")}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">
                      Confidence
                    </p>
                    <p className="text-xs text-zinc-400">
                      {exp.confidence !== null
                        ? `${(exp.confidence * 100).toFixed(1)}%`
                        : "Pending"}{" "}
                      / {(exp.targetConfidence * 100).toFixed(0)}% target
                    </p>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-none overflow-hidden">
                    <div
                      className={`h-full rounded-none transition-all ${
                        exp.confidence !== null &&
                        exp.confidence >= exp.targetConfidence
                          ? "bg-emerald-500"
                          : "bg-accent"
                      }`}
                      style={{
                        width: `${
                          exp.confidence !== null
                            ? Math.min(exp.confidence * 100, 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Winner (if completed) */}
              {exp.winnerVariant && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                    Winner
                  </p>
                  <p className="text-sm text-accent font-medium">
                    {exp.winnerVariant}
                  </p>
                </div>
              )}

              {/* Outcome */}
              {exp.outcome && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                    Outcome
                  </p>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {exp.outcome}
                  </p>
                </div>
              )}

              {/* Learnings */}
              {exp.learnings && (
                <div className="border-t border-white/5 pt-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                    Learnings
                  </p>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {exp.learnings}
                  </p>
                </div>
              )}

              {/* Dates */}
              <div className="flex gap-4 text-xs text-zinc-600">
                <span>
                  Created:{" "}
                  {new Date(exp.createdAt).toLocaleDateString()}
                </span>
                {exp.startedAt && (
                  <span>
                    Started:{" "}
                    {new Date(exp.startedAt).toLocaleDateString()}
                  </span>
                )}
                {exp.completedAt && (
                  <span>
                    Completed:{" "}
                    {new Date(exp.completedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
