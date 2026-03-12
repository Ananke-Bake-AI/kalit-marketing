"use client";

import { useEffect, useState } from "react";

interface MemoryEntry {
  id: string;
  type: string;
  title: string;
  content: string;
  confidence: number;
  evidenceCount: number;
  tags: string[];
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

interface Workspace {
  id: string;
  name: string;
}

const typeConfig: Record<string, { label: string; color: string }> = {
  winning_angle: {
    label: "Winning Angle",
    color: "bg-emerald-500/20 text-emerald-400",
  },
  failing_angle: {
    label: "Failing Angle",
    color: "bg-red-500/20 text-red-400",
  },
  audience_insight: {
    label: "Audience Insight",
    color: "bg-blue-500/20 text-blue-400",
  },
  channel_insight: {
    label: "Channel Insight",
    color: "bg-cyan-500/20 text-cyan-400",
  },
  creative_pattern: {
    label: "Creative Pattern",
    color: "bg-purple-500/20 text-purple-400",
  },
  funnel_insight: {
    label: "Funnel Insight",
    color: "bg-orange-500/20 text-orange-400",
  },
  brand_learning: {
    label: "Brand Learning",
    color: "bg-pink-500/20 text-pink-400",
  },
  experiment_result: {
    label: "Experiment Result",
    color: "bg-yellow-500/20 text-yellow-400",
  },
};

const typeBarColors: Record<string, string> = {
  winning_angle: "bg-emerald-500",
  failing_angle: "bg-red-500",
  audience_insight: "bg-blue-500",
  channel_insight: "bg-cyan-500",
  creative_pattern: "bg-purple-500",
  funnel_insight: "bg-orange-500",
  brand_learning: "bg-pink-500",
  experiment_result: "bg-yellow-500",
};

export default function MemoryPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");

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
    fetch(`/api/workspaces/${selectedWorkspace}/memory`)
      .then((r) => r.json())
      .then((data) => {
        setMemories(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedWorkspace]);

  const filtered =
    typeFilter === "all"
      ? memories
      : memories.filter((m) => m.type === typeFilter);

  // Already sorted by confidence desc from the API
  const types = ["all", ...Object.keys(typeConfig)];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-sans">
            Memory
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Accumulated learnings and insights from growth operations
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

      {/* Type Filters */}
      <div className="flex gap-2 flex-wrap">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-none border transition-colors ${
              typeFilter === t
                ? "bg-accent/10 border-accent text-accent"
                : "bg-card border-white/5 text-zinc-400 hover:border-white/10"
            }`}
          >
            {t === "all" ? "All" : typeConfig[t]?.label || t}
            {t !== "all" && (
              <span className="ml-1 text-zinc-600">
                ({memories.filter((m) => m.type === t).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Memory Grid */}
      {loading ? (
        <div className="card p-12 text-center">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-zinc-500 mt-3">Loading memories...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-zinc-500">No memories found</p>
          <p className="text-xs text-zinc-600 mt-1">
            Memories are accumulated as the system learns from campaign
            performance and experiments
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((m) => {
            const cfg = typeConfig[m.type] || {
              label: m.type,
              color: "bg-zinc-500/20 text-zinc-400",
            };
            const barColor = typeBarColors[m.type] || "bg-zinc-500";

            return (
              <div key={m.id} className="card p-4 space-y-3">
                {/* Type badge + title */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-none mb-2 ${cfg.color}`}
                    >
                      {cfg.label}
                    </span>
                    <h3 className="text-white font-medium leading-snug">
                      {m.title}
                    </h3>
                  </div>
                </div>

                {/* Content */}
                <p className="text-sm text-zinc-400 leading-relaxed line-clamp-3">
                  {m.content}
                </p>

                {/* Confidence bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-zinc-500">Confidence</p>
                    <p className="text-xs text-zinc-400 font-mono">
                      {(m.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-none overflow-hidden">
                    <div
                      className={`h-full rounded-none transition-all ${barColor}`}
                      style={{ width: `${m.confidence * 100}%` }}
                    />
                  </div>
                </div>

                {/* Evidence count */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-600">
                    {m.evidenceCount} evidence point{m.evidenceCount !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {new Date(m.updatedAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Tags */}
                {m.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {m.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 text-[10px] bg-white/5 text-zinc-500 rounded-none"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
