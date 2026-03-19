"use client";

import { useEffect, useState } from "react";
import { CampaignCreatePrompt } from "@/components/dashboard/campaign-create-prompt";

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  platform: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  cpa: number | null;
  roas: number | null;
  dailyBudget: number;
}

interface Workspace {
  id: string;
  name: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-zinc-500/20 text-zinc-400",
  pending_review: "bg-yellow-500/20 text-yellow-400",
  active: "bg-emerald-500/20 text-emerald-400",
  paused: "bg-orange-500/20 text-orange-400",
  optimizing: "bg-blue-500/20 text-blue-400",
  scaling: "bg-purple-500/20 text-purple-400",
  fatigued: "bg-red-500/20 text-red-400",
  completed: "bg-zinc-500/20 text-zinc-400",
};

const typeLabels: Record<string, string> = {
  paid_search: "Paid Search",
  paid_social: "Paid Social",
  display: "Display",
  video: "Video",
  shopping: "Shopping",
  email: "Email",
  seo: "SEO",
  content: "Content",
};

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

export default function CampaignsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
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
    fetch(`/api/workspaces/${selectedWorkspace}/campaigns`)
      .then((r) => r.json())
      .then((data) => {
        setCampaigns(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedWorkspace]);

  const filtered =
    filter === "all" ? campaigns : campaigns.filter((c) => c.status === filter);

  const totals = campaigns.reduce(
    (acc, c) => ({
      spend: acc.spend + c.spend,
      impressions: acc.impressions + c.impressions,
      clicks: acc.clicks + c.clicks,
      conversions: acc.conversions + c.conversions,
      revenue: acc.revenue + c.revenue,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }
  );

  const overallRoas = totals.spend > 0 ? totals.revenue / totals.spend : null;
  const overallCpa =
    totals.conversions > 0 ? totals.spend / totals.conversions : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-sans">
            Campaigns
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Campaign performance across all channels
          </p>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Create Campaign */}
      {selectedWorkspace && (
        <CampaignCreatePrompt workspaceId={selectedWorkspace} />
      )}

      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Spend", value: formatCurrency(totals.spend) },
          {
            label: "Impressions",
            value: formatNumber(totals.impressions),
          },
          { label: "Clicks", value: formatNumber(totals.clicks) },
          {
            label: "Conversions",
            value: formatNumber(totals.conversions),
          },
          {
            label: "ROAS",
            value: overallRoas ? `${overallRoas.toFixed(2)}x` : "—",
            highlight: overallRoas !== null && overallRoas >= 2,
          },
          {
            label: "Avg CPA",
            value: overallCpa ? formatCurrency(overallCpa) : "—",
          },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">
              {stat.label}
            </p>
            <p
              className={`text-xl font-bold mt-1 ${
                "highlight" in stat && stat.highlight
                  ? "text-accent"
                  : "text-white"
              }`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          "all",
          "active",
          "paused",
          "optimizing",
          "draft",
          "scaling",
          "fatigued",
        ].map((s) => (
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
                ({campaigns.filter((c) => c.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Campaign Table */}
      {loading ? (
        <div className="card p-12 text-center">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-zinc-500 mt-3">Loading campaigns...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-zinc-500">No campaigns found</p>
          <p className="text-xs text-zinc-600 mt-1">
            Campaigns will appear once workspaces enter the execution phase
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="text-left p-3 font-medium">Campaign</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Budget</th>
                  <th className="text-right p-3 font-medium">Spend</th>
                  <th className="text-right p-3 font-medium">Impr.</th>
                  <th className="text-right p-3 font-medium">Clicks</th>
                  <th className="text-right p-3 font-medium">Conv.</th>
                  <th className="text-right p-3 font-medium">CPA</th>
                  <th className="text-right p-3 font-medium">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    onClick={() => {
                      if (selectedWorkspace) {
                        window.location.href = `/dashboard/workspaces/${selectedWorkspace}/campaigns/${c.id}`;
                      }
                    }}
                  >
                    <td className="p-3">
                      <p className="text-white font-medium group-hover:text-accent transition-colors">{c.name}</p>
                      <p className="text-xs text-zinc-600 mt-0.5">
                        {c.platform}
                      </p>
                    </td>
                    <td className="p-3 text-zinc-400">
                      {typeLabels[c.type] || c.type}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-medium rounded-none ${
                          statusColors[c.status] ||
                          "bg-zinc-500/20 text-zinc-400"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3 text-right text-zinc-400">
                      {formatCurrency(c.dailyBudget)}/d
                    </td>
                    <td className="p-3 text-right text-white">
                      {formatCurrency(c.spend)}
                    </td>
                    <td className="p-3 text-right text-zinc-400">
                      {formatNumber(c.impressions)}
                    </td>
                    <td className="p-3 text-right text-zinc-400">
                      {formatNumber(c.clicks)}
                    </td>
                    <td className="p-3 text-right text-white">
                      {formatNumber(c.conversions)}
                    </td>
                    <td className="p-3 text-right text-zinc-400">
                      {c.cpa !== null ? formatCurrency(c.cpa) : "—"}
                    </td>
                    <td
                      className={`p-3 text-right font-medium ${
                        c.roas !== null && c.roas >= 2
                          ? "text-accent"
                          : c.roas !== null && c.roas >= 1
                            ? "text-emerald-400"
                            : "text-zinc-400"
                      }`}
                    >
                      {c.roas !== null ? `${c.roas.toFixed(2)}x` : "—"}
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
