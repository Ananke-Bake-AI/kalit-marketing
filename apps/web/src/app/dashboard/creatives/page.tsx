"use client";

import { useEffect, useState } from "react";

interface Creative {
  id: string;
  title: string | null;
  type: string;
  status: string;
  version: number;
  content: unknown;
  impressions: number;
  clicks: number;
  conversions: number;
  fatigueScore: number | null;
  tags: string[];
  messagingAngle: string | null;
  targetSegment: string | null;
  createdAt: string;
}

interface Workspace {
  id: string;
  name: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-zinc-500/20 text-text-secondary",
  pending_review: "bg-yellow-500/20 text-yellow-400",
  approved: "bg-blue-500/20 text-blue-400",
  rejected: "bg-red-500/20 text-red-400",
  active: "bg-emerald-500/20 text-emerald-600",
  fatigued: "bg-red-500/20 text-red-400",
  archived: "bg-zinc-500/20 text-text-secondary",
};

const typeLabels: Record<string, string> = {
  ad_copy: "Ad Copy",
  headline: "Headline",
  hook: "Hook",
  cta: "CTA",
  static_image: "Static Image",
  video_script: "Video Script",
  ugc_concept: "UGC Concept",
  carousel: "Carousel",
  email_copy: "Email Copy",
  social_post: "Social Post",
  blog_draft: "Blog Draft",
  landing_page_variant: "Landing Page",
};

const typeColors: Record<string, string> = {
  ad_copy: "bg-blue-500/20 text-blue-400",
  headline: "bg-purple-500/20 text-purple-400",
  hook: "bg-cyan-500/20 text-cyan-400",
  cta: "bg-orange-500/20 text-orange-400",
  static_image: "bg-pink-500/20 text-pink-400",
  video_script: "bg-red-500/20 text-red-400",
  ugc_concept: "bg-yellow-500/20 text-yellow-400",
  carousel: "bg-indigo-500/20 text-indigo-400",
  email_copy: "bg-emerald-500/20 text-emerald-600",
  social_post: "bg-teal-500/20 text-teal-400",
  blog_draft: "bg-lime-500/20 text-lime-400",
  landing_page_variant: "bg-fuchsia-500/20 text-fuchsia-400",
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function CreativesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
    fetch(`/api/workspaces/${selectedWorkspace}/creatives`)
      .then((r) => r.json())
      .then((data) => {
        setCreatives(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedWorkspace]);

  const filtered = creatives.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    return true;
  });

  const statuses = ["all", "active", "draft", "pending_review", "approved", "fatigued", "rejected", "archived"];
  const types = ["all", ...Object.keys(typeLabels)];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text font-sans">Creatives</h1>
          <p className="text-sm text-text-secondary mt-1">
            Creative assets and performance tracking
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
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-text-secondary uppercase tracking-wider mr-1">Status</span>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-none border transition-colors ${
                statusFilter === s
                  ? "bg-accent/10 border-accent text-accent"
                  : "bg-surface shadow-card rounded-3xl border-divider text-text-secondary hover:border-divider"
              }`}
            >
              {s === "all" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-text-secondary uppercase tracking-wider mr-1">Type</span>
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-none border transition-colors ${
                typeFilter === t
                  ? "bg-accent/10 border-accent text-accent"
                  : "bg-surface shadow-card rounded-3xl border-divider text-text-secondary hover:border-divider"
              }`}
            >
              {t === "all" ? "All" : typeLabels[t] || t}
            </button>
          ))}
        </div>
      </div>

      {/* Creative Grid */}
      {loading ? (
        <div className="card p-12 text-center">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-text-secondary mt-3">Loading creatives...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-text-secondary">No creatives found</p>
          <p className="text-xs text-text-secondary mt-1">
            Creatives will appear once the production pipeline generates assets
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.id} className="card p-4 space-y-3">
              {/* Title & Version */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-text font-medium truncate">
                    {c.title || "Untitled Creative"}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">v{c.version}</p>
                </div>
              </div>

              {/* Badges */}
              <div className="flex gap-2 flex-wrap">
                <span
                  className={`inline-block px-2 py-0.5 text-xs font-medium rounded-none ${
                    typeColors[c.type] || "bg-zinc-500/20 text-text-secondary"
                  }`}
                >
                  {typeLabels[c.type] || c.type}
                </span>
                <span
                  className={`inline-block px-2 py-0.5 text-xs font-medium rounded-none ${
                    statusColors[c.status] || "bg-zinc-500/20 text-text-secondary"
                  }`}
                >
                  {c.status.replace("_", " ")}
                </span>
              </div>

              {/* Performance Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs text-text-secondary">Impressions</p>
                  <p className="text-sm text-text font-medium">
                    {formatNumber(c.impressions)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Clicks</p>
                  <p className="text-sm text-text font-medium">
                    {formatNumber(c.clicks)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Conversions</p>
                  <p className="text-sm text-text font-medium">
                    {formatNumber(c.conversions)}
                  </p>
                </div>
              </div>

              {/* CTR */}
              {c.impressions > 0 && (
                <div>
                  <p className="text-xs text-text-secondary">
                    CTR: {((c.clicks / c.impressions) * 100).toFixed(2)}%
                  </p>
                </div>
              )}

              {/* Fatigue Score */}
              {c.fatigueScore !== null && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-text-secondary">Fatigue Score</p>
                    <p
                      className={`text-xs font-medium ${
                        c.fatigueScore >= 0.7
                          ? "text-red-400"
                          : c.fatigueScore >= 0.4
                            ? "text-yellow-400"
                            : "text-emerald-600"
                      }`}
                    >
                      {(c.fatigueScore * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="w-full h-1.5 bg-subtle rounded-none overflow-hidden">
                    <div
                      className={`h-full rounded-none transition-all ${
                        c.fatigueScore >= 0.7
                          ? "bg-red-500"
                          : c.fatigueScore >= 0.4
                            ? "bg-yellow-500"
                            : "bg-emerald-500"
                      }`}
                      style={{ width: `${c.fatigueScore * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Tags */}
              {c.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {c.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 text-[10px] bg-subtle text-text-secondary rounded-none"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
