"use client";

import { useState, useEffect, useRef } from "react";
import {
  Share2,
  Loader2,
  Wand2,
  Upload,
  X,
  ChevronDown,
  Star,
  Check,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";
import { PlatformPreviewCard } from "@/components/social/platform-preview-cards";

// ─── Types ───────────────────────────────────────────────────────

interface Workspace { id: string; name: string; }
interface Asset { id: string; name: string; url: string; mimeType: string; isPrimary: boolean; category: string; }
interface PlatformInfo { id: string; name: string; maxChars: number; tone: string; }
interface ProviderInfo { id: string; name: string; capabilities: string[]; costPerImage?: string; tier: string; }

interface PostResult {
  id: string;
  platform: string;
  content: string;
  hashtags: string[];
  mediaUrls: string[];
  charCount: number;
  charLimit: number;
}

// ─── Platform Icons ──────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, { icon: string; color: string }> = {
  x: { icon: "𝕏", color: "#ffffff" },
  meta: { icon: "◎", color: "#E1306C" },
  linkedin: { icon: "in", color: "#0A66C2" },
  reddit: { icon: "⬡", color: "#FF4500" },
  tiktok: { icon: "♪", color: "#00F2EA" },
};

// ─── Page ────────────────────────────────────────────────────────

export default function SocialPage() {
  // Workspace
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState("");
  const [brandName, setBrandName] = useState<string | undefined>();

  // Data
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  // Form
  const [prompt, setPrompt] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["x", "linkedin", "meta"]);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("auto");
  const [generateImages, setGenerateImages] = useState(true);
  const [importedUrls, setImportedUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Results
  const [generating, setGenerating] = useState(false);
  const [posts, setPosts] = useState<PostResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");

  // Fetch workspaces
  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data) => {
        setWorkspaces(data);
        if (data.length > 0 && !selectedWorkspace) setSelectedWorkspace(data[0].id);
      })
      .catch(() => {});
  }, [selectedWorkspace]);

  // Fetch platforms, providers, assets on workspace change
  useEffect(() => {
    if (!selectedWorkspace) return;

    fetch(`/api/workspaces/${selectedWorkspace}/social/generate`)
      .then((r) => r.json())
      .then((data) => setPlatforms(data.platforms ?? []))
      .catch(() => {});

    fetch(`/api/workspaces/${selectedWorkspace}/generate`)
      .then((r) => r.json())
      .then((data) => {
        const imgProviders = (data.providers ?? []).filter(
          (p: ProviderInfo) => !p.capabilities.includes("video")
        );
        setProviders(imgProviders);
      })
      .catch(() => {});

    fetch(`/api/workspaces/${selectedWorkspace}/assets`)
      .then((r) => r.json())
      .then((data) => setAssets(data))
      .catch(() => {});

    // Get brand name from workspace config
    fetch(`/api/workspaces/${selectedWorkspace}`)
      .then((r) => r.json())
      .then((data) => setBrandName(data.config?.productName ?? data.name))
      .catch(() => {});
  }, [selectedWorkspace]);

  // Toggle platform
  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  // Toggle asset
  const toggleAsset = (id: string) => {
    setSelectedAssets((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  // Import image
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !selectedWorkspace) return;
    setUploading(true);
    const formData = new FormData();
    for (const f of Array.from(e.target.files)) formData.append("files", f);

    try {
      const res = await fetch(`/api/workspaces/${selectedWorkspace}/social/upload`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setImportedUrls((prev) => [...prev, ...data.urls]);
      }
    } catch { /* ignore */ } finally {
      setUploading(false);
    }
  };

  // Generate
  const handleGenerate = async () => {
    if (!prompt || !selectedPlatforms.length || !selectedWorkspace) return;
    setGenerating(true);
    setError(null);
    setPosts([]);
    setSummary("");

    try {
      const res = await fetch(`/api/workspaces/${selectedWorkspace}/social/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          platforms: selectedPlatforms,
          assetIds: selectedAssets.length ? selectedAssets : undefined,
          importedImageUrls: importedUrls.length ? importedUrls : undefined,
          imageProviderId: selectedProvider === "auto" ? undefined : selectedProvider,
          generateImages,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setPosts(data.posts ?? []);
      setSummary(data.summary ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setGenerating(false);
    }
  };

  // Update post content locally
  const updatePostContent = (postId: string, content: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, content, charCount: content.length } : p
      )
    );
  };

  // Save draft
  const saveDraft = async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    await fetch(`/api/workspaces/${selectedWorkspace}/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: post.content }),
    });
  };

  const imageAssets = assets.filter((a) => a.mimeType.startsWith("image/"));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow mb-1">Social Media</p>
          <h1 className="text-2xl font-bold tracking-tight text-text">Content Creator</h1>
          <p className="mt-1 text-xs text-text-secondary">
            Generate ready-to-post social content across all platforms from a single prompt
          </p>
        </div>
        {workspaces.length > 1 && (
          <div className="relative">
            <select value={selectedWorkspace} onChange={(e) => setSelectedWorkspace(e.target.value)} className="input pr-8 text-xs">
              {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-text-secondary" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* ─── Left: Controls ─── */}
        <div className="space-y-4 xl:col-span-1">
          {/* Prompt */}
          <div className="card-white p-4">
            <p className="eyebrow mb-2">What do you want to post?</p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='e.g. "Launch announcement for our new pentest automation feature — highlight speed and accuracy"'
              rows={4}
              className="input w-full text-xs"
            />
            {/* Import images */}
            <div className="mt-3">
              <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={handleImport} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-[10px] text-text-secondary hover:text-accent"
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                Import images
              </button>
              {importedUrls.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {importedUrls.map((url, i) => (
                    <div key={i} className="group relative h-12 w-12">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button
                        onClick={() => setImportedUrls((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center bg-red-500 text-text group-hover:flex"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Platforms */}
          <div className="card-white p-4">
            <p className="eyebrow mb-3">Platforms</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {(platforms.length ? platforms : [
                { id: "x", name: "X" },
                { id: "meta", name: "Instagram" },
                { id: "linkedin", name: "LinkedIn" },
                { id: "reddit", name: "Reddit" },
                { id: "tiktok", name: "TikTok" },
              ]).map((p) => {
                const selected = selectedPlatforms.includes(p.id);
                const style = PLATFORM_ICONS[p.id];
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={`flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-all ${
                      selected
                        ? "border border-divider bg-black/[0.03]"
                        : "border border-divider text-text-secondary hover:border-divider"
                    }`}
                  >
                    <div className={`flex h-4 w-4 items-center justify-center border ${selected ? "border-accent bg-accent text-black" : "border-divider"}`}>
                      {selected && <Check className="h-2.5 w-2.5" />}
                    </div>
                    <span style={{ color: selected ? style?.color : undefined }}>{style?.icon}</span>
                    <span className={selected ? "text-text" : ""}>{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Brand Assets */}
          {imageAssets.length > 0 && (
            <div className="card-white p-4">
              <p className="eyebrow mb-2">Brand Assets</p>
              <p className="mb-3 text-[10px] text-text-secondary">Use as visual references for image generation</p>
              <div className="grid grid-cols-5 gap-1.5">
                {imageAssets.slice(0, 10).map((asset) => {
                  const selected = selectedAssets.includes(asset.id);
                  return (
                    <button
                      key={asset.id}
                      onClick={() => toggleAsset(asset.id)}
                      className={`relative overflow-hidden transition-all ${
                        selected ? "ring-2 ring-accent ring-offset-1 ring-offset-body" : "opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={asset.url} alt={asset.name} className="aspect-square w-full object-cover" />
                      {asset.isPrimary && <Star className="absolute right-0.5 top-0.5 h-2.5 w-2.5 fill-accent text-accent" />}
                      {selected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-accent/20">
                          <Check className="h-3 w-3 text-accent" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Image Generation */}
          <div className="card-white p-4">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Image Generation</p>
              <label className="flex cursor-pointer items-center gap-2">
                <span className="text-[10px] text-text-secondary">{generateImages ? "On" : "Off"}</span>
                <button
                  onClick={() => setGenerateImages(!generateImages)}
                  className={`h-5 w-9 transition-colors ${generateImages ? "bg-accent/30" : "bg-subtle-strong"}`}
                >
                  <div className={`h-4 w-4 bg-white transition-transform ${generateImages ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                </button>
              </label>
            </div>
            {generateImages && (
              <div className="mt-3">
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="input w-full text-xs"
                >
                  <option value="auto">Auto (recommended)</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.costPerImage ? `(${p.costPerImage})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !prompt || !selectedPlatforms.length}
            className={`btn-primary w-full py-3 text-xs ${generating || !prompt || !selectedPlatforms.length ? "opacity-50" : ""}`}
          >
            {generating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating for {selectedPlatforms.length} platform{selectedPlatforms.length > 1 ? "s" : ""}...</>
            ) : (
              <><Wand2 className="mr-2 h-4 w-4" />Generate Social Content</>
            )}
          </button>
        </div>

        {/* ─── Right: Results ─── */}
        <div className="xl:col-span-2">
          {error && (
            <div className="card mb-4 p-4 text-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {posts.length === 0 && !generating ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Share2 className="mb-4 h-12 w-12 text-text-secondary" />
              <p className="text-sm text-text-secondary">Ready to create</p>
              <p className="mt-1 text-center text-xs text-text-secondary">
                Describe what you want to post — AI generates tailored content<br />
                for each platform with matching visuals
              </p>
            </div>
          ) : generating ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="mb-4 h-8 w-8 animate-spin text-accent" />
              <p className="text-sm text-text">Creating content for {selectedPlatforms.length} platforms...</p>
              <p className="mt-1 text-xs text-text-secondary">Generating text + images — this takes 15-40 seconds</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              {summary && (
                <div className="flex items-center gap-2 border border-accent/20 bg-accent/[0.04] px-4 py-2">
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  <p className="text-xs text-accent">{summary}</p>
                </div>
              )}

              {/* Preview cards */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {posts.map((post) => (
                  <PlatformPreviewCard
                    key={post.id}
                    post={post}
                    brandName={brandName}
                    onContentChange={(content) => updatePostContent(post.id, content)}
                    onSave={() => saveDraft(post.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
