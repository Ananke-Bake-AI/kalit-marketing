"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

interface ContentStepProps {
  workspaceId: string;
  creativesCount: number;
  onComplete: () => void;
  onBack: () => void;
}

interface GeneratedVariation {
  headline: string;
  body: string;
  cta: string;
}

const contentTypes = [
  { value: "ad_copy", label: "Ad Copy" },
  { value: "social_post", label: "Social Post" },
  { value: "email_copy", label: "Email Copy" },
];

const channels = [
  { value: "meta", label: "Meta" },
  { value: "google", label: "Google" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X" },
];

export function ContentStep({
  workspaceId,
  creativesCount,
  onComplete,
  onBack,
}: ContentStepProps) {
  const [contentType, setContentType] = useState("ad_copy");
  const [channel, setChannel] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [variations, setVariations] = useState<GeneratedVariation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(creativesCount > 0);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/content/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: contentType, channel }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate content");
      }

      const data = await res.json();
      setVariations(data.variations || []);
      setGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-[-0.04em] text-white">
          Create Your First Content
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Let&apos;s generate marketing content using AI based on your product
          and brand.
        </p>
      </div>

      {!generated ? (
        <div className="max-w-xl">
          {/* Content type */}
          <div className="mb-5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">
              Content Type
            </p>
            <div className="flex gap-2">
              {contentTypes.map((ct) => (
                <button
                  key={ct.value}
                  onClick={() => setContentType(ct.value)}
                  className={`border px-4 py-2 text-xs font-medium transition-all ${
                    contentType === ct.value
                      ? "border-accent/30 bg-accent/15 text-accent"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20"
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Channel */}
          <div className="mb-6">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">
              Channel (optional)
            </p>
            <div className="flex flex-wrap gap-2">
              {channels.map((ch) => (
                <button
                  key={ch.value}
                  onClick={() =>
                    setChannel(channel === ch.value ? null : ch.value)
                  }
                  className={`border px-3 py-1.5 text-[10px] font-medium transition-all ${
                    channel === ch.value
                      ? "border-accent/30 bg-accent/15 text-accent"
                      : "border-white/10 bg-white/[0.03] text-slate-500 hover:border-white/20"
                  }`}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary px-6 py-2.5 text-xs disabled:opacity-50"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating...
              </span>
            ) : (
              "Generate Content"
            )}
          </button>

          {error && (
            <div className="mt-4 border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>
      ) : (
        <div>
          {variations.length > 0 ? (
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {variations.map((v, i) => (
                <div
                  key={i}
                  className="border border-emerald-500/20 bg-emerald-500/5 p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      Variation {i + 1}
                    </span>
                    <span className="badge bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                      <Check className="mr-1 h-2.5 w-2.5" />
                      Created
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {v.headline}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {v.body}
                  </p>
                  <p className="mt-2 text-xs font-medium text-accent">
                    {v.cta}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mb-6 border border-emerald-500/20 bg-emerald-500/5 p-5">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400" />
                <p className="text-sm text-emerald-400">
                  {creativesCount} creative{creativesCount !== 1 ? "s" : ""}{" "}
                  already created for this workspace.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={onBack}
          className="btn-secondary px-4 py-2 text-xs"
        >
          Back
        </button>
        <button
          onClick={onComplete}
          disabled={!generated}
          className="btn-primary px-6 py-2 text-xs disabled:opacity-30"
        >
          Continue to Launch
        </button>
      </div>
    </div>
  );
}
