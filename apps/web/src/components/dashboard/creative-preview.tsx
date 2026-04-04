"use client";

import { ExternalLink, MousePointerClick, FileText } from "lucide-react";

interface CreativeContent {
  headline?: string;
  body?: string;
  cta?: string;
  destinationUrl?: string;
  descriptions?: string[];
}

interface CreativePreviewProps {
  title?: string | null;
  content: CreativeContent | Record<string, unknown>;
  type: string;
  status: string;
  messagingAngle?: string | null;
  tags?: string[];
  compact?: boolean;
}

const statusColors: Record<string, string> = {
  draft: "bg-zinc-500/20 text-text-secondary border-zinc-500/30",
  pending_review: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30",
  active: "bg-accent/20 text-accent border-accent/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  fatigued: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

export function CreativePreview({
  title,
  content,
  type,
  status,
  messagingAngle,
  tags,
  compact,
}: CreativePreviewProps) {
  const c = content as CreativeContent;

  if (compact) {
    return (
      <div className="p-3 bg-transparent border border-divider hover:border-divider transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text truncate">
              {c.headline || title || "Untitled"}
            </p>
            <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-2">
              {c.body || "No body copy"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`badge text-[9px] ${statusColors[status] || "bg-zinc-500/20 text-text-secondary"}`}>
              {status}
            </span>
          </div>
        </div>
        {c.cta && (
          <div className="mt-2 flex items-center gap-1.5">
            <MousePointerClick className="h-3 w-3 text-accent/60" />
            <span className="text-[10px] font-medium text-accent">{c.cta}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 bg-transparent border border-divider hover:border-divider transition-colors">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-3.5 w-3.5 text-text-secondary" />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">
          {type.replace(/_/g, " ")}
        </span>
        <span className={`badge text-[9px] ${statusColors[status] || "bg-zinc-500/20 text-text-secondary"}`}>
          {status}
        </span>
      </div>

      {/* Headline */}
      <p className="text-sm font-semibold text-text leading-snug">
        {c.headline || title || "Untitled"}
      </p>

      {/* Body */}
      {c.body && (
        <p className="mt-2 text-xs text-text-secondary leading-relaxed">
          {c.body}
        </p>
      )}

      {/* Additional descriptions (for responsive search ads) */}
      {c.descriptions && c.descriptions.length > 0 && (
        <div className="mt-2 space-y-1">
          {c.descriptions.map((d, i) => (
            <p key={i} className="text-[11px] text-text-secondary pl-3 border-l border-divider">
              {d}
            </p>
          ))}
        </div>
      )}

      {/* CTA + URL */}
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        {c.cta && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent/10 border border-accent/20 text-accent text-[11px] font-semibold">
            <MousePointerClick className="h-3 w-3" />
            {c.cta}
          </span>
        )}
        {c.destinationUrl && (
          <span className="inline-flex items-center gap-1 text-[10px] text-text-secondary">
            <ExternalLink className="h-3 w-3" />
            {c.destinationUrl}
          </span>
        )}
      </div>

      {/* Messaging angle + tags */}
      {(messagingAngle || (tags && tags.length > 0)) && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {messagingAngle && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {messagingAngle}
            </span>
          )}
          {tags?.map((tag) => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-subtle text-text-secondary">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
