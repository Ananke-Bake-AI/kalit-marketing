"use client";

import { useState, useRef } from "react";
import { Globe, Upload, Loader2, Check, X, FileText } from "lucide-react";

interface ContextStepProps {
  workspaceId: string;
  hasContext: boolean;
  onComplete: () => void;
  onBack: () => void;
}

interface ExtractedData {
  productName?: string;
  productDescription?: string;
  industry?: string;
  brandVoice?: string;
  targetAudience?: string;
  competitors?: string[];
  keyFeatures?: string[];
  valueProposition?: string;
  contentThemes?: string[];
}

export function ContextStep({
  workspaceId,
  hasContext,
  onComplete,
  onBack,
}: ContextStepProps) {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(hasContext);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyzeUrl = async () => {
    if (!url.trim()) return;

    setAnalyzing(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "website", url: url.trim() }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      if (data.extracted) {
        setExtracted(data.extracted);
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setError(null);
    setUploadedFile(file.name);

    try {
      const text = await file.text();

      const res = await fetch(
        `/api/workspaces/${workspaceId}/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "file",
            content: text,
            fileName: file.name,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      if (data.extracted) {
        setExtracted(data.extracted);
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "File analysis failed");
      setUploadedFile(null);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-[-0.04em] text-white">
          Import Your Context
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Share your website or reference files so our AI can understand your
          brand, product, and audience automatically.
        </p>
      </div>

      {!done ? (
        <div className="max-w-xl">
          {/* Website URL */}
          <div className="mb-6">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">
              Website URL
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-startup.com"
                  className="w-full border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-3 text-xs text-white placeholder:text-slate-600 focus:border-accent/30 focus:outline-none"
                  disabled={analyzing}
                />
              </div>
              <button
                onClick={handleAnalyzeUrl}
                disabled={analyzing || !url.trim()}
                className="btn-primary px-5 py-2.5 text-xs disabled:opacity-50"
              >
                {analyzing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analyzing...
                  </span>
                ) : (
                  "Analyze"
                )}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="mb-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] text-slate-600">OR</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* File upload */}
          <div className="mb-6">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">
              Upload Reference File
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf,.doc,.docx,.csv"
              onChange={handleFileUpload}
              className="hidden"
              disabled={analyzing}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={analyzing}
              className="flex items-center gap-3 border border-dashed border-white/10 bg-white/[0.02] px-5 py-4 text-xs text-slate-400 transition-all hover:border-white/20 hover:text-white disabled:opacity-50"
            >
              {uploadedFile ? (
                <>
                  <FileText className="h-4 w-4" />
                  {uploadedFile}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Brand guide, pitch deck, product brief...
                </>
              )}
            </button>
            <p className="mt-1.5 text-[10px] text-slate-600">
              .txt, .md, .pdf, .doc, .csv supported
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 border border-red-500/30 bg-red-500/10 p-3">
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>
      ) : (
        <div>
          {extracted ? (
            <div className="mb-6 max-w-2xl">
              <div className="mb-4 flex items-center gap-2 border border-emerald-500/20 bg-emerald-500/5 p-3">
                <Check className="h-4 w-4 text-emerald-400" />
                <p className="text-sm text-emerald-400">
                  Context extracted and saved to workspace memory.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {extracted.productName && (
                  <InfoCard label="Product" value={extracted.productName} />
                )}
                {extracted.industry && (
                  <InfoCard label="Industry" value={extracted.industry} />
                )}
                {extracted.brandVoice && (
                  <InfoCard label="Brand Voice" value={extracted.brandVoice} />
                )}
                {extracted.targetAudience && (
                  <InfoCard
                    label="Target Audience"
                    value={extracted.targetAudience}
                  />
                )}
                {extracted.valueProposition && (
                  <InfoCard
                    label="Value Proposition"
                    value={extracted.valueProposition}
                    span
                  />
                )}
                {extracted.keyFeatures && extracted.keyFeatures.length > 0 && (
                  <InfoCard
                    label="Key Features"
                    value={extracted.keyFeatures.join(", ")}
                    span
                  />
                )}
                {extracted.competitors && extracted.competitors.length > 0 && (
                  <InfoCard
                    label="Competitors"
                    value={extracted.competitors.join(", ")}
                  />
                )}
                {extracted.contentThemes &&
                  extracted.contentThemes.length > 0 && (
                    <InfoCard
                      label="Content Themes"
                      value={extracted.contentThemes.join(", ")}
                    />
                  )}
              </div>
            </div>
          ) : (
            <div className="mb-6 border border-emerald-500/20 bg-emerald-500/5 p-5">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400" />
                <p className="text-sm text-emerald-400">
                  Context already imported for this workspace.
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
        <div className="flex items-center gap-3">
          {!done && (
            <button
              onClick={onComplete}
              className="text-xs text-slate-600 transition-colors hover:text-slate-400"
            >
              Skip
            </button>
          )}
          <button
            onClick={onComplete}
            className="btn-primary px-6 py-2 text-xs"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  span,
}: {
  label: string;
  value: string;
  span?: boolean;
}) {
  return (
    <div
      className={`border border-white/5 bg-white/[0.02] p-3 ${
        span ? "sm:col-span-2" : ""
      }`}
    >
      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="text-xs leading-relaxed text-white">{value}</p>
    </div>
  );
}
