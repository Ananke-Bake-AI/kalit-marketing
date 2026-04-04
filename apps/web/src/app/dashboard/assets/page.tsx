"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderOpen,
  Search,
  Grid3X3,
  List,
  Trash2,
  Star,
  StarOff,
  Pencil,
  Download,
  Image,
  FileText,
  Film,
  Type,
  Palette,
  Layout,
  ChevronDown,
  X,
  Eye,
  Plus,
  Pipette,
  Loader2,
} from "lucide-react";
import { AssetUpload } from "@/components/dashboard/asset-upload";

// ─── Types ───────────────────────────────────────────────────────

interface Asset {
  id: string;
  workspaceId: string;
  category: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  thumbnailUrl: string | null;
  name: string;
  description: string | null;
  tags: string[];
  width: number | null;
  height: number | null;
  usageNotes: string | null;
  isPrimary: boolean;
  storageProvider: string;
  createdAt: string;
  updatedAt: string;
}

interface Workspace {
  id: string;
  name: string;
}

// ─── Constants ───────────────────────────────────────────────────

const CATEGORIES = [
  { value: "all", label: "All Assets", icon: FolderOpen },
  { value: "logo", label: "Logos", icon: Star },
  { value: "brand_image", label: "Brand Images", icon: Image },
  { value: "product_screenshot", label: "Screenshots", icon: Layout },
  { value: "icon", label: "Icons", icon: Palette },
  { value: "font", label: "Fonts", icon: Type },
  { value: "color_swatch", label: "Colors", icon: Palette },
  { value: "guideline_doc", label: "Guidelines", icon: FileText },
  { value: "social_template", label: "Social Templates", icon: Layout },
  { value: "ad_template", label: "Ad Templates", icon: Layout },
  { value: "video", label: "Videos", icon: Film },
  { value: "raw_asset", label: "Other", icon: FileText },
];

const CATEGORY_COLORS: Record<string, string> = {
  logo: "bg-accent/15 text-accent border-accent/30",
  brand_image: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  product_screenshot: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  icon: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  font: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  color_swatch: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  guideline_doc: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  social_template: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  ad_template: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  video: "bg-red-500/15 text-red-400 border-red-500/30",
  raw_asset: "bg-slate-500/15 text-text-secondary border-slate-500/30",
};

// ─── Helper ──────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getCategoryLabel(cat: string): string {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

// ─── Page ────────────────────────────────────────────────────────

export default function AssetsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showUpload, setShowUpload] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", usageNotes: "", category: "", tags: "" });
  const [extractedPalette, setExtractedPalette] = useState<Array<{ hex: string; label: string; percentage: number }> | null>(null);
  const [extracting, setExtracting] = useState(false);

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

  // Fetch assets
  const fetchAssets = useCallback(async () => {
    if (!selectedWorkspace) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (search) params.set("search", search);
      const res = await fetch(`/api/workspaces/${selectedWorkspace}/assets?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedWorkspace, category, search]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Delete asset
  const deleteAsset = async (asset: Asset) => {
    if (!confirm(`Delete "${asset.name}"?`)) return;
    await fetch(`/api/workspaces/${selectedWorkspace}/assets/${asset.id}`, {
      method: "DELETE",
    });
    fetchAssets();
  };

  // Toggle primary
  const togglePrimary = async (asset: Asset) => {
    await fetch(`/api/workspaces/${selectedWorkspace}/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrimary: !asset.isPrimary }),
    });
    fetchAssets();
  };

  // Save edit
  const saveEdit = async () => {
    if (!editingAsset) return;
    await fetch(`/api/workspaces/${selectedWorkspace}/assets/${editingAsset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        description: editForm.description || null,
        usageNotes: editForm.usageNotes || null,
        category: editForm.category,
        tags: editForm.tags ? editForm.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      }),
    });
    setEditingAsset(null);
    fetchAssets();
  };

  // Start editing
  const startEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setEditForm({
      name: asset.name,
      description: asset.description || "",
      usageNotes: asset.usageNotes || "",
      category: asset.category,
      tags: asset.tags.join(", "),
    });
  };

  // Extract brand colors
  const extractBrandColors = async () => {
    if (!selectedWorkspace) return;
    setExtracting(true);
    try {
      const res = await fetch(`/api/workspaces/${selectedWorkspace}/brand-extract`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setExtractedPalette(data.colors?.slice(0, 6).map((c: { hex: string; label: string; percentage: number }) => ({
          hex: c.hex,
          label: c.label,
          percentage: c.percentage,
        })) ?? null);
      }
    } catch {
      // ignore
    } finally {
      setExtracting(false);
    }
  };

  // Stats
  const totalSize = assets.reduce((s, a) => s + a.fileSize, 0);
  const categoryCounts = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.category] = (acc[a.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow mb-1">Workspace Assets</p>
          <h1 className="text-2xl font-bold tracking-tight text-text">Brand Drive</h1>
          <p className="mt-1 text-xs text-text-secondary">
            Upload logos, images, and brand assets — AI uses these to generate on-brand creatives
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Workspace Selector */}
          {workspaces.length > 1 && (
            <div className="relative">
              <select
                value={selectedWorkspace}
                onChange={(e) => setSelectedWorkspace(e.target.value)}
                className="input pr-8 text-xs"
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-text-secondary" />
            </div>
          )}
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="btn-primary px-4 py-2 text-xs"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Upload
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4">
        <div className="glass-pill">
          <FolderOpen className="h-3 w-3" />
          {assets.length} asset{assets.length !== 1 ? "s" : ""}
        </div>
        <div className="glass-pill">
          {formatFileSize(totalSize)} total
        </div>
        {Object.entries(categoryCounts).map(([cat, count]) => (
          <div key={cat} className={`badge ${CATEGORY_COLORS[cat] || CATEGORY_COLORS.raw_asset}`}>
            {getCategoryLabel(cat)}: {count}
          </div>
        ))}
      </div>

      {/* Brand Palette Extraction */}
      {assets.length > 0 && (
        <div className="card-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Pipette className="h-4 w-4 text-accent" />
              <div>
                <p className="text-xs font-medium text-text">Brand Color Palette</p>
                <p className="text-[10px] text-text-secondary">Auto-extract dominant colors from your brand assets</p>
              </div>
            </div>
            <button
              onClick={extractBrandColors}
              disabled={extracting}
              className="btn-secondary px-3 py-1.5 text-[10px]"
            >
              {extracting ? (
                <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Extracting...</>
              ) : (
                <><Pipette className="mr-1.5 h-3 w-3" />Extract Colors</>
              )}
            </button>
          </div>
          {extractedPalette && extractedPalette.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              {extractedPalette.map((color, i) => (
                <div key={i} className="group relative">
                  <div
                    className="h-10 w-10 border border-divider transition-transform hover:scale-110"
                    style={{ backgroundColor: color.hex }}
                  />
                  <div className="absolute -bottom-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap bg-text px-2 py-1 text-[9px] text-text group-hover:block">
                    {color.hex} — {color.label} ({color.percentage}%)
                  </div>
                </div>
              ))}
              <span className="ml-2 text-[10px] text-text-secondary">Saved to workspace config</span>
            </div>
          )}
        </div>
      )}

      {/* Upload Panel */}
      {showUpload && selectedWorkspace && (
        <div className="card-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">Upload Assets</h2>
            <button onClick={() => setShowUpload(false)} className="text-text-secondary hover:text-text">
              <X className="h-4 w-4" />
            </button>
          </div>
          <AssetUpload
            workspaceId={selectedWorkspace}
            onUploaded={() => {
              setShowUpload(false);
              fetchAssets();
            }}
          />
        </div>
      )}

      {/* Filters & Controls */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets..."
            className="input w-full pl-9 text-xs"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-1 overflow-x-auto">
          {CATEGORIES.filter(c => c.value === "all" || categoryCounts[c.value]).map((cat) => {
            const active = category === cat.value;
            const Icon = cat.icon;
            return (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all ${
                  active
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : "border border-divider text-text-secondary hover:text-text hover:border-divider"
                }`}
              >
                <Icon className="h-3 w-3" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* View Toggle */}
        <div className="flex border border-divider">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 ${viewMode === "grid" ? "bg-subtle-strong text-text" : "text-text-secondary hover:text-text"}`}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 ${viewMode === "list" ? "bg-subtle-strong text-text" : "text-text-secondary hover:text-text"}`}
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Assets Grid/List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <FolderOpen className="mb-4 h-12 w-12 text-text-secondary" />
          <p className="text-sm text-text-secondary">No assets yet</p>
          <p className="mt-1 text-xs text-text-secondary">
            Upload your startup&apos;s logos, images, and brand materials to get started
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="btn-primary mt-4 px-4 py-2 text-xs"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Upload First Asset
          </button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onPreview={() => setPreviewAsset(asset)}
              onEdit={() => startEdit(asset)}
              onDelete={() => deleteAsset(asset)}
              onTogglePrimary={() => togglePrimary(asset)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {assets.map((asset) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              onPreview={() => setPreviewAsset(asset)}
              onEdit={() => startEdit(asset)}
              onDelete={() => deleteAsset(asset)}
              onTogglePrimary={() => togglePrimary(asset)}
            />
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewAsset && (
        <AssetPreviewModal
          asset={previewAsset}
          onClose={() => setPreviewAsset(null)}
        />
      )}

      {/* Edit Modal */}
      {editingAsset && (
        <AssetEditModal
          editForm={editForm}
          setEditForm={setEditForm}
          onSave={saveEdit}
          onClose={() => setEditingAsset(null)}
        />
      )}
    </div>
  );
}

// ─── Asset Card (Grid View) ─────────────────────────────────────

function AssetCard({
  asset,
  onPreview,
  onEdit,
  onDelete,
  onTogglePrimary,
}: {
  asset: Asset;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePrimary: () => void;
}) {
  const isImage = asset.mimeType.startsWith("image/");
  const isVideo = asset.mimeType.startsWith("video/");

  return (
    <div className="card group hover-lift relative flex flex-col overflow-hidden">
      {/* Primary badge */}
      {asset.isPrimary && (
        <div className="absolute left-2 top-2 z-10">
          <div className="badge bg-accent/20 text-accent border-accent/40">
            <Star className="mr-1 h-2.5 w-2.5 fill-current" />
            Primary
          </div>
        </div>
      )}

      {/* Thumbnail */}
      <div
        className="relative flex h-36 cursor-pointer items-center justify-center bg-transparent"
        onClick={onPreview}
      >
        {isImage ? (
          <img
            src={asset.url}
            alt={asset.name}
            className="h-full w-full object-contain p-2"
          />
        ) : isVideo ? (
          <Film className="h-10 w-10 text-text-secondary" />
        ) : (
          <FileText className="h-10 w-10 text-text-secondary" />
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <Eye className="h-5 w-5 text-text" />
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-xs font-medium text-text">{asset.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className={`badge text-[8px] ${CATEGORY_COLORS[asset.category] || CATEGORY_COLORS.raw_asset}`}>
            {getCategoryLabel(asset.category)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-text-secondary">
          <span>{formatFileSize(asset.fileSize)}</span>
          {asset.width && asset.height && (
            <span>{asset.width}x{asset.height}</span>
          )}
        </div>

        {/* Tags */}
        {asset.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {asset.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="bg-subtle px-1.5 py-0.5 text-[9px] text-text-secondary">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button onClick={onTogglePrimary} className="p-1 text-text-secondary hover:text-accent" title="Toggle primary">
            {asset.isPrimary ? <StarOff className="h-3 w-3" /> : <Star className="h-3 w-3" />}
          </button>
          <button onClick={onEdit} className="p-1 text-text-secondary hover:text-accent" title="Edit">
            <Pencil className="h-3 w-3" />
          </button>
          <a href={asset.url} download={asset.fileName} className="p-1 text-text-secondary hover:text-text" title="Download">
            <Download className="h-3 w-3" />
          </a>
          <button onClick={onDelete} className="ml-auto p-1 text-text-secondary hover:text-red-400" title="Delete">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Asset Row (List View) ──────────────────────────────────────

function AssetRow({
  asset,
  onPreview,
  onEdit,
  onDelete,
  onTogglePrimary,
}: {
  asset: Asset;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePrimary: () => void;
}) {
  const isImage = asset.mimeType.startsWith("image/");

  return (
    <div className="group flex items-center gap-4 border border-divider bg-transparent px-4 py-2.5 transition-all hover:border-divider hover:bg-subtle">
      {/* Thumbnail */}
      <div
        className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center bg-transparent"
        onClick={onPreview}
      >
        {isImage ? (
          <img src={asset.url} alt={asset.name} className="h-full w-full object-contain" />
        ) : (
          <FileText className="h-4 w-4 text-text-secondary" />
        )}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-xs font-medium text-text">{asset.name}</p>
          {asset.isPrimary && (
            <Star className="h-3 w-3 shrink-0 fill-accent text-accent" />
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-text-secondary">
          <span>{asset.fileName}</span>
          <span>{formatFileSize(asset.fileSize)}</span>
          {asset.width && asset.height && <span>{asset.width}x{asset.height}</span>}
        </div>
      </div>

      {/* Category */}
      <span className={`badge text-[8px] ${CATEGORY_COLORS[asset.category] || CATEGORY_COLORS.raw_asset}`}>
        {getCategoryLabel(asset.category)}
      </span>

      {/* Tags */}
      <div className="hidden gap-1 lg:flex">
        {asset.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="bg-subtle px-1.5 py-0.5 text-[9px] text-text-secondary">
            {tag}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={onTogglePrimary} className="p-1.5 text-text-secondary hover:text-accent">
          {asset.isPrimary ? <StarOff className="h-3 w-3" /> : <Star className="h-3 w-3" />}
        </button>
        <button onClick={onEdit} className="p-1.5 text-text-secondary hover:text-accent">
          <Pencil className="h-3 w-3" />
        </button>
        <a href={asset.url} download={asset.fileName} className="p-1.5 text-text-secondary hover:text-text">
          <Download className="h-3 w-3" />
        </a>
        <button onClick={onDelete} className="p-1.5 text-text-secondary hover:text-red-400">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Preview Modal ──────────────────────────────────────────────

function AssetPreviewModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const isImage = asset.mimeType.startsWith("image/");
  const isVideo = asset.mimeType.startsWith("video/");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="card-white relative max-h-[90vh] max-w-4xl w-full overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute right-4 top-4 z-10 text-text-secondary hover:text-text">
          <X className="h-5 w-5" />
        </button>

        {/* Preview content */}
        <div className="flex min-h-[300px] items-center justify-center bg-black/30 p-4">
          {isImage ? (
            <img src={asset.url} alt={asset.name} className="max-h-[60vh] object-contain" />
          ) : isVideo ? (
            <video src={asset.url} controls className="max-h-[60vh]" />
          ) : (
            <div className="flex flex-col items-center py-20">
              <FileText className="mb-4 h-16 w-16 text-text-secondary" />
              <p className="text-sm text-text-secondary">Preview not available</p>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="space-y-3 p-6">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-text">{asset.name}</h3>
            {asset.isPrimary && (
              <div className="badge bg-accent/20 text-accent border-accent/40">
                <Star className="mr-1 h-2.5 w-2.5 fill-current" />
                Primary
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
            <div>
              <p className="eyebrow mb-0.5">Category</p>
              <p className="text-text">{getCategoryLabel(asset.category)}</p>
            </div>
            <div>
              <p className="eyebrow mb-0.5">Size</p>
              <p className="text-text">{formatFileSize(asset.fileSize)}</p>
            </div>
            <div>
              <p className="eyebrow mb-0.5">Dimensions</p>
              <p className="text-text">
                {asset.width && asset.height ? `${asset.width} x ${asset.height}` : "N/A"}
              </p>
            </div>
            <div>
              <p className="eyebrow mb-0.5">Type</p>
              <p className="text-text">{asset.mimeType}</p>
            </div>
          </div>

          {asset.description && (
            <div>
              <p className="eyebrow mb-0.5">Description</p>
              <p className="text-xs text-text-secondary">{asset.description}</p>
            </div>
          )}

          {asset.usageNotes && (
            <div>
              <p className="eyebrow mb-0.5">AI Usage Notes</p>
              <p className="text-xs text-text-secondary">{asset.usageNotes}</p>
            </div>
          )}

          {asset.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {asset.tags.map((tag) => (
                <span key={tag} className="bg-subtle px-2 py-0.5 text-[10px] text-text-secondary">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <a href={asset.url} download={asset.fileName} className="btn-secondary px-3 py-1.5 text-[10px]">
              <Download className="mr-1.5 h-3 w-3" />
              Download
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal ─────────────────────────────────────────────────

function AssetEditModal({
  editForm,
  setEditForm,
  onSave,
  onClose,
}: {
  editForm: { name: string; description: string; usageNotes: string; category: string; tags: string };
  setEditForm: (form: typeof editForm) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const CATEGORY_OPTIONS = [
    { value: "logo", label: "Logo" },
    { value: "brand_image", label: "Brand Image" },
    { value: "product_screenshot", label: "Product Screenshot" },
    { value: "icon", label: "Icon" },
    { value: "font", label: "Font" },
    { value: "color_swatch", label: "Color Swatch" },
    { value: "guideline_doc", label: "Brand Guideline" },
    { value: "social_template", label: "Social Template" },
    { value: "ad_template", label: "Ad Template" },
    { value: "video", label: "Video" },
    { value: "raw_asset", label: "Other" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="card-white w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="section-title">Edit Asset</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-secondary">Name</label>
            <input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="input w-full text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-secondary">Category</label>
            <select
              value={editForm.category}
              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              className="input w-full text-xs"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-secondary">Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={2}
              className="input w-full text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-secondary">
              AI Usage Notes
            </label>
            <input
              value={editForm.usageNotes}
              onChange={(e) => setEditForm({ ...editForm, usageNotes: e.target.value })}
              placeholder="How should AI use this asset in creatives?"
              className="input w-full text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-secondary">Tags</label>
            <input
              value={editForm.tags}
              onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
              placeholder="Comma-separated tags"
              className="input w-full text-xs"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-xs">
            Cancel
          </button>
          <button onClick={onSave} className="btn-primary px-4 py-2 text-xs">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
