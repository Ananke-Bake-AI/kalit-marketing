"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Target, Tag, Monitor, Smartphone, Globe, Search } from "lucide-react";
import { CreativePreview } from "./creative-preview";

interface AdGroupCreativeData {
  id: string;
  isActive: boolean;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  creative: {
    id: string;
    type: string;
    status: string;
    title: string | null;
    content: Record<string, unknown>;
    messagingAngle: string | null;
    tags: string[];
  };
}

interface AdGroupData {
  id: string;
  name: string;
  targeting: Record<string, unknown> | null;
  placements: string[] | unknown[] | null;
  dailyBudget: number | null;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  creatives: AdGroupCreativeData[];
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function CampaignAdGroupCard({ adGroup }: { adGroup: AdGroupData }) {
  const [expanded, setExpanded] = useState(false);

  const targeting = adGroup.targeting || {};
  const keywords = (targeting.keywords as string[]) || [];
  const locations = (targeting.locations as string[]) || [];
  const interests = (targeting.interests as string[]) || [];
  const devices = (targeting.devices as string[]) || [];
  const ageMin = targeting.ageMin as number | undefined;
  const ageMax = targeting.ageMax as number | undefined;

  return (
    <div className="border border-divider bg-transparent hover:border-divider transition-colors">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-3 text-left cursor-pointer"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-text-secondary shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-text-secondary shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text truncate">{adGroup.name}</p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {keywords.length > 0 && (
              <span className="text-[10px] text-text-secondary flex items-center gap-1">
                <Search className="h-3 w-3" />
                {keywords.length} keywords
              </span>
            )}
            {adGroup.creatives.length > 0 && (
              <span className="text-[10px] text-text-secondary">
                {adGroup.creatives.length} ad{adGroup.creatives.length > 1 ? "s" : ""}
              </span>
            )}
            {devices.length > 0 && (
              <span className="text-[10px] text-text-secondary flex items-center gap-1">
                {devices.includes("mobile") && <Smartphone className="h-3 w-3" />}
                {devices.includes("desktop") && <Monitor className="h-3 w-3" />}
              </span>
            )}
          </div>
        </div>

        {/* Mini stats */}
        <div className="flex items-center gap-4 shrink-0 text-right">
          {adGroup.dailyBudget && (
            <div>
              <p className="text-[10px] text-text-secondary">Budget</p>
              <p className="text-xs text-text font-medium">${adGroup.dailyBudget}/d</p>
            </div>
          )}
          <div>
            <p className="text-[10px] text-text-secondary">Impr.</p>
            <p className="text-xs text-text-secondary">{formatNumber(adGroup.impressions)}</p>
          </div>
          <div>
            <p className="text-[10px] text-text-secondary">Clicks</p>
            <p className="text-xs text-text-secondary">{formatNumber(adGroup.clicks)}</p>
          </div>
          <div>
            <p className="text-[10px] text-text-secondary">Conv.</p>
            <p className="text-xs text-text font-medium">{formatNumber(adGroup.conversions)}</p>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-divider pt-4 space-y-4">
          {/* Targeting details */}
          <div>
            <p className="eyebrow mb-2 flex items-center gap-1.5">
              <Target className="h-3 w-3" />
              Targeting
            </p>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((kw) => (
                <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px]">
                  <Search className="h-2.5 w-2.5" />
                  {kw}
                </span>
              ))}
              {locations.map((loc) => (
                <span key={loc} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[10px]">
                  <Globe className="h-2.5 w-2.5" />
                  {loc}
                </span>
              ))}
              {interests.map((int) => (
                <span key={int} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px]">
                  <Tag className="h-2.5 w-2.5" />
                  {int}
                </span>
              ))}
              {(ageMin || ageMax) && (
                <span className="px-2 py-0.5 bg-subtle text-text-secondary text-[10px]">
                  Age: {ageMin || "18"}–{ageMax || "65+"}
                </span>
              )}
              {devices.map((d) => (
                <span key={d} className="px-2 py-0.5 bg-subtle text-text-secondary text-[10px] capitalize">
                  {d}
                </span>
              ))}
            </div>
          </div>

          {/* Creatives / Ads */}
          <div>
            <p className="eyebrow mb-2">
              Ads ({adGroup.creatives.length})
            </p>
            <div className="space-y-2">
              {adGroup.creatives.map((agc) => (
                <CreativePreview
                  key={agc.id}
                  title={agc.creative.title}
                  content={agc.creative.content}
                  type={agc.creative.type}
                  status={agc.creative.status}
                  messagingAngle={agc.creative.messagingAngle}
                  tags={agc.creative.tags}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
