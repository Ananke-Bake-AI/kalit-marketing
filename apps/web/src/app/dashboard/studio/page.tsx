"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wand2,
  Image,
  Film,
  Layers,
  ChevronDown,
  Loader2,
  Check,
  Star,
  Zap,
  Eye,
  Download,
  Save,
  X,
  Sparkles,
  RefreshCw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface Workspace {
  id: string;
  name: string;
}

interface Asset {
  id: string;
  name: string;
  category: string;
  url: string;
  mimeType: string;
  isPrimary: boolean;
  usageNotes: string | null;
}

interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  costPerImage?: string;
  costPerVideo?: string;
  supportsReferenceImages: boolean;
  tier: string;
}

interface GenerationResult {
  url: string;
  width: number;
  height: number;
  prompt: string;
  model: string;
  provider: string;
  storedUrl?: string;
  metadata?: Record<string, unknown>;
}

// ─── Constants ───────────────────────────────────────────────────

const ASPECT_RATIOS = [
  { value: "1:1", label: "1:1 Square", desc: "Instagram, Facebook" },
  { value: "16:9", label: "16:9 Landscape", desc: "YouTube, Display" },
  { value: "9:16", label: "9:16 Portrait", desc: "Stories, TikTok, Reels" },
  { value: "4:5", label: "4:5 Portrait", desc: "Instagram Feed" },
];

const STYLE_PRESETS = [
  { value: "", label: "Auto" },
  { value: "photorealistic", label: "Photorealistic" },
  { value: "illustration", label: "Illustration" },
  { value: "3d", label: "3D Render" },
  { value: "vector", label: "Vector / Flat" },
];

const TIER_COLORS: Record<string, string> = {
  premium: "bg-accent/15 text-accent border-accent/30",
  standard: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  budget: "bg-slate-500/15 text-text-secondary border-slate-500/30",
};

// ─── Page ────────────────────────────────────────────────────────

export default function StudioPage() {
  // State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState("");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  // Generation form
  const [mode, setMode] = useState<"single" | "compare" | "video">("single");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [style, setStyle] = useState("");
  const [duration, setDuration] = useState(5);

  // Results
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<Record<string, GenerationResult | { error: string }>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Fetch workspaces
  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data) => {
        setWorkspaces(data);
        if (data.length > 0 && !selectedWorkspace) {
          setSelectedWorkspace(data[0].id);
        }
      })
      .catch(() => {});
  }, [selectedWorkspace]);

  // Fetch providers + assets when workspace changes
  useEffect(() => {
    if (!selectedWorkspace) return;

    fetch(`/api/workspaces/${selectedWorkspace}/generate`)
      .then((r) => r.json())
      .then((data) => {
        setProviders(data.providers ?? []);
        // Default: select first image provider
        const imageProviders = (data.providers ?? []).filter(
          (p: ProviderInfo) => !p.capabilities.includes("video")
        );
        if (imageProviders.length > 0 && selectedProviders.length === 0) {
          setSelectedProviders([imageProviders[0].id]);
        }
      })
      .catch(() => {});

    fetch(`/api/workspaces/${selectedWorkspace}/assets`)
      .then((r) => r.json())
      .then((data) => setAssets(data))
      .catch(() => {});
  }, [selectedWorkspace]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleProvider = useCallback(
    (id: string) => {
      if (mode === "single" || mode === "video") {
        setSelectedProviders([id]);
      } else {
        setSelectedProviders((prev) =>
          prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
        );
      }
    },
    [mode]
  );

  const toggleAsset = (id: string) => {
    setSelectedAssets((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  // Generate
  const handleGenerate = async () => {
    if (!prompt || !selectedProviders.length || !selectedWorkspace) return;
    setGenerating(true);
    setResults({});

    try {
      const res = await fetch(`/api/workspaces/${selectedWorkspace}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          providers: selectedProviders,
          prompt,
          negativePrompt: negativePrompt || undefined,
          assetIds: selectedAssets,
          aspectRatio,
          style: style || undefined,
          duration,
          saveToCreatives: false,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResults({ error: { error: data.error || "Generation failed" } });
        return;
      }

      if (data.mode === "compare") {
        setResults(data.results);
      } else if (data.mode === "single" && data.result) {
        setResults({ [selectedProviders[0]]: data.result });
      } else if (data.mode === "video" && data.result) {
        setResults({ [selectedProviders[0]]: data.result });
      }
    } catch (err) {
      setResults({ error: { error: err instanceof Error ? err.message : "Failed" } });
    } finally {
      setGenerating(false);
    }
  };

  // Save result as creative
  const saveAsCreative = async (providerId: string) => {
    const result = results[providerId];
    if (!result || "error" in result) return;

    await fetch(`/api/workspaces/${selectedWorkspace}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "single",
        providers: [providerId],
        prompt,
        assetIds: selectedAssets,
        aspectRatio,
        style: style || undefined,
        saveToCreatives: true,
      }),
    });
  };

  // Separate providers by type
  const imageProviders = providers.filter((p) => !p.capabilities.includes("video"));
  const videoProviders = providers.filter((p) => p.capabilities.includes("video"));
  const relevantProviders = mode === "video" ? videoProviders : imageProviders;
  const imageAssets = assets.filter((a) => a.mimeType.startsWith("image/"));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow mb-1">AI Generation</p>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Creative Studio
          </h1>
          <p className="mt-1 text-xs text-text-secondary">
            Generate images and videos using your brand assets — compare multiple AI models side-by-side
          </p>
        </div>
        {workspaces.length > 1 && (
          <div className="relative">
            <select
              value={selectedWorkspace}
              onChange={(e) => setSelectedWorkspace(e.target.value)}
              className="input pr-8 text-xs"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-text-secondary" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left Column — Generation Controls */}
        <div className="space-y-4 xl:col-span-1">
          {/* Mode Selector */}
          <div className="card-white p-4">
            <p className="eyebrow mb-3">Mode</p>
            <div className="flex gap-2">
              {[
                { value: "single", label: "Single", icon: Image },
                { value: "compare", label: "Compare", icon: Layers },
                { value: "video", label: "Video", icon: Film },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => {
                    setMode(value as typeof mode);
                    setSelectedProviders([]);
                    setResults({});
                  }}
                  className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-[10px] font-semibold uppercase tracking-wider transition-all ${
                    mode === value
                      ? "bg-accent/15 text-accent border border-accent/30"
                      : "border border-divider text-text-secondary hover:text-text"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            {mode === "compare" && (
              <p className="mt-2 text-[10px] text-text-secondary">
                Select multiple providers to generate the same prompt with each and compare results
              </p>
            )}
          </div>

          {/* Prompt */}
          <div className="card-white p-4">
            <p className="eyebrow mb-2">Prompt</p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the creative you want to generate..."
              rows={4}
              className="input w-full text-xs"
            />
            <div className="mt-2">
              <button
                onClick={() => setNegativePrompt(negativePrompt ? "" : " ")}
                className="text-[10px] text-text-secondary hover:text-text-secondary"
              >
                {negativePrompt ? "- Hide" : "+ Add"} negative prompt
              </button>
              {negativePrompt !== "" && (
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="What to avoid: blurry, low quality, text errors..."
                  rows={2}
                  className="input mt-1 w-full text-xs"
                />
              )}
            </div>
          </div>

          {/* Options */}
          <div className="card-white p-4">
            <p className="eyebrow mb-3">Options</p>
            <div className="space-y-3">
              {/* Aspect Ratio */}
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-secondary">
                  Aspect Ratio
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ASPECT_RATIOS.map((ar) => (
                    <button
                      key={ar.value}
                      onClick={() => setAspectRatio(ar.value)}
                      className={`px-2 py-1.5 text-left text-[10px] transition-all ${
                        aspectRatio === ar.value
                          ? "bg-accent/15 text-accent border border-accent/30"
                          : "border border-divider text-text-secondary hover:text-text"
                      }`}
                    >
                      <span className="font-bold">{ar.label}</span>
                      <br />
                      <span className="text-[9px] text-text-secondary">{ar.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Style */}
              {mode !== "video" && (
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-secondary">
                    Style
                  </label>
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="input w-full text-xs"
                  >
                    {STYLE_PRESETS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Duration (video only) */}
              {mode === "video" && (
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-secondary">
                    Duration
                  </label>
                  <div className="flex gap-2">
                    {[5, 10].map((d) => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={`flex-1 py-1.5 text-xs ${
                          duration === d
                            ? "bg-accent/15 text-accent border border-accent/30"
                            : "border border-divider text-text-secondary"
                        }`}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Provider Selection */}
          <div className="card-white p-4">
            <p className="eyebrow mb-3">
              {mode === "compare" ? "Select Providers to Compare" : "Provider"}
            </p>
            <div className="space-y-1.5">
              {relevantProviders.map((provider) => {
                const selected = selectedProviders.includes(provider.id);
                return (
                  <button
                    key={provider.id}
                    onClick={() => toggleProvider(provider.id)}
                    className={`flex w-full items-start gap-3 p-3 text-left transition-all ${
                      selected
                        ? "bg-accent/[0.06] border border-accent/30"
                        : "border border-divider hover:border-divider"
                    }`}
                  >
                    <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border ${
                      selected ? "border-accent bg-accent text-black" : "border-divider"
                    }`}>
                      {selected && <Check className="h-2.5 w-2.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-text">{provider.name}</span>
                        <span className={`badge text-[8px] ${TIER_COLORS[provider.tier] ?? TIER_COLORS.standard}`}>
                          {provider.tier}
                        </span>
                        {provider.costPerImage && (
                          <span className="text-[9px] text-text-secondary">{provider.costPerImage}/img</span>
                        )}
                        {provider.costPerVideo && (
                          <span className="text-[9px] text-text-secondary">{provider.costPerVideo}/vid</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[10px] text-text-secondary line-clamp-2">
                        {provider.description}
                      </p>
                      {provider.supportsReferenceImages && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[9px] text-cyan-500">
                          <Sparkles className="h-2.5 w-2.5" />
                          Supports brand asset references
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Brand Asset References */}
          {imageAssets.length > 0 && mode !== "video" && (
            <div className="card-white p-4">
              <p className="eyebrow mb-2">Brand Asset References</p>
              <p className="mb-3 text-[10px] text-text-secondary">
                Select assets to use as visual references for generation
              </p>
              <div className="grid grid-cols-4 gap-2">
                {imageAssets.map((asset) => {
                  const selected = selectedAssets.includes(asset.id);
                  return (
                    <button
                      key={asset.id}
                      onClick={() => toggleAsset(asset.id)}
                      className={`group relative overflow-hidden transition-all ${
                        selected
                          ? "ring-2 ring-accent ring-offset-1 ring-offset-body"
                          : "opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="aspect-square w-full object-cover"
                      />
                      {asset.isPrimary && (
                        <Star className="absolute right-1 top-1 h-3 w-3 fill-accent text-accent" />
                      )}
                      {selected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-accent/20">
                          <Check className="h-4 w-4 text-accent" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !prompt || !selectedProviders.length}
            className={`btn-primary w-full py-3 text-xs ${
              generating || !prompt || !selectedProviders.length ? "opacity-50" : ""
            }`}
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                {mode === "compare"
                  ? `Generate with ${selectedProviders.length} Provider${selectedProviders.length > 1 ? "s" : ""}`
                  : mode === "video"
                    ? "Generate Video"
                    : "Generate Image"}
              </>
            )}
          </button>
        </div>

        {/* Right Column — Results */}
        <div className="xl:col-span-2">
          {Object.keys(results).length === 0 && !generating ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Wand2 className="mb-4 h-12 w-12 text-text-secondary" />
              <p className="text-sm text-text-secondary">Ready to generate</p>
              <p className="mt-1 text-xs text-text-secondary">
                Write a prompt, select providers and brand assets, then hit generate
              </p>
            </div>
          ) : generating ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="mb-4 h-8 w-8 animate-spin text-accent" />
              <p className="text-sm text-text">Generating with {selectedProviders.length} provider(s)...</p>
              <p className="mt-1 text-xs text-text-secondary">This may take 10-30 seconds per provider</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="eyebrow">
                  Results ({Object.keys(results).filter((k) => k !== "error").length})
                </p>
                <button
                  onClick={handleGenerate}
                  className="flex items-center gap-1.5 text-[10px] text-text-secondary hover:text-accent"
                >
                  <RefreshCw className="h-3 w-3" />
                  Regenerate
                </button>
              </div>

              <div className={`grid gap-4 ${
                mode === "compare" && Object.keys(results).length > 1
                  ? "grid-cols-1 lg:grid-cols-2"
                  : "grid-cols-1"
              }`}>
                {Object.entries(results).map(([providerId, result]) => {
                  if (providerId === "error" && "error" in result) {
                    return (
                      <div key="error" className="card p-6 text-center">
                        <p className="text-sm text-red-400">{result.error}</p>
                      </div>
                    );
                  }

                  if ("error" in result) {
                    return (
                      <div key={providerId} className="card p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-xs font-medium text-text">
                            {providers.find((p) => p.id === providerId)?.name ?? providerId}
                          </span>
                          <span className="badge bg-red-500/15 text-red-400 border-red-500/30 text-[8px]">
                            Failed
                          </span>
                        </div>
                        <p className="text-xs text-red-400">{result.error}</p>
                      </div>
                    );
                  }

                  const providerName = providers.find((p) => p.id === providerId)?.name ?? providerId;

                  return (
                    <div key={providerId} className="card overflow-hidden">
                      {/* Provider header */}
                      <div className="flex items-center justify-between border-b border-divider px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Zap className="h-3 w-3 text-accent" />
                          <span className="text-xs font-semibold text-text">{providerName}</span>
                          <span className="font-mono text-[9px] text-text-secondary">{result.model}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setPreviewUrl(result.storedUrl ?? result.url)}
                            className="p-1.5 text-text-secondary hover:text-text"
                            title="Preview"
                          >
                            <Eye className="h-3 w-3" />
                          </button>
                          <a
                            href={result.storedUrl ?? result.url}
                            download
                            className="p-1.5 text-text-secondary hover:text-text"
                            title="Download"
                          >
                            <Download className="h-3 w-3" />
                          </a>
                          <button
                            onClick={() => saveAsCreative(providerId)}
                            className="p-1.5 text-text-secondary hover:text-accent"
                            title="Save to Creatives"
                          >
                            <Save className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* Image/Video */}
                      <div
                        className="group relative flex cursor-pointer items-center justify-center bg-black/20"
                        onClick={() => setPreviewUrl(result.storedUrl ?? result.url)}
                      >
                        {"duration" in result ? (
                          <video
                            src={result.url}
                            controls
                            className="max-h-[500px] w-full object-contain"
                          />
                        ) : (
                          <img
                            src={result.storedUrl ?? result.url}
                            alt={result.prompt}
                            className="max-h-[500px] w-full object-contain"
                          />
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="px-4 py-2">
                        <p className="truncate text-[10px] text-text-secondary" title={result.prompt}>
                          {result.prompt}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-[9px] text-text-secondary">
                          <span>{result.width}x{result.height}</span>
                          <span>{result.provider}</span>
                          {"duration" in result && <span>{(result as { duration: number }).duration}s</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setPreviewUrl(null)}
        >
          <button className="absolute right-4 top-4 text-text-secondary hover:text-text">
            <X className="h-6 w-6" />
          </button>
          {previewUrl.includes(".mp4") || previewUrl.includes(".webm") ? (
            <video src={previewUrl} controls className="max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={previewUrl} alt="Preview" className="max-h-[90vh] max-w-[90vw] object-contain" />
          )}
        </div>
      )}
    </div>
  );
}
