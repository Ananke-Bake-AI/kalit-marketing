"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2, Check, Image, FileText, Film } from "lucide-react";

interface AssetUploadProps {
  workspaceId: string;
  category?: string;
  onUploaded: () => void;
}

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

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return Image;
  if (type.startsWith("video/")) return Film;
  return FileText;
}

export function AssetUpload({ workspaceId, category: defaultCategory, onUploaded }: AssetUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState(defaultCategory || "raw_asset");
  const [usageNotes, setUsageNotes] = useState("");
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...dropped].slice(0, 20));
  }, []);

  const handleSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selected].slice(0, 20));
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      for (const f of files) {
        formData.append("files", f);
      }
      formData.append("category", category);
      if (usageNotes) formData.append("usageNotes", usageNotes);
      if (tags) formData.append("tags", tags);

      const res = await fetch(`/api/workspaces/${workspaceId}/assets`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      setDone(true);
      setFiles([]);
      setUsageNotes("");
      setTags("");
      setTimeout(() => {
        setDone(false);
        onUploaded();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`group relative flex cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 py-10 transition-all duration-200 ${
          dragOver
            ? "border-accent/60 bg-accent/[0.06]"
            : "border-divider bg-transparent hover:border-accent/30 hover:bg-subtle"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.svg,.woff,.woff2,.ttf,.otf,.ai,.psd,.fig"
          onChange={handleSelect}
          className="hidden"
        />
        <Upload className={`mb-3 h-8 w-8 transition-colors ${dragOver ? "text-accent" : "text-text-secondary group-hover:text-text-secondary"}`} />
        <p className="text-sm font-medium text-text">
          {dragOver ? "Drop files here" : "Drag & drop files or click to browse"}
        </p>
        <p className="mt-1 text-[11px] text-text-secondary">
          Images, videos, fonts, PDFs — up to 50MB each, max 20 files
        </p>
      </div>

      {/* Selected Files */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="eyebrow">
              {files.length} file{files.length > 1 ? "s" : ""} selected
              <span className="ml-2 text-text-secondary">
                ({(totalSize / (1024 * 1024)).toFixed(1)} MB)
              </span>
            </p>
            <button
              onClick={() => setFiles([])}
              className="text-[10px] uppercase tracking-widest text-text-secondary hover:text-red-400"
            >
              Clear all
            </button>
          </div>

          <div className="max-h-48 space-y-1 overflow-y-auto">
            {files.map((file, i) => {
              const Icon = getFileIcon(file.type);
              return (
                <div key={i} className="flex items-center gap-2 border border-divider bg-transparent px-3 py-1.5">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
                  <span className="flex-1 truncate text-xs text-text">{file.name}</span>
                  <span className="text-[10px] text-text-secondary">
                    {(file.size / 1024).toFixed(0)}KB
                  </span>
                  <button onClick={() => removeFile(i)} className="text-text-secondary hover:text-red-400">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Upload Options */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-secondary">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
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
              <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-secondary">
                Tags
              </label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="brand, hero, dark-bg..."
                className="input w-full text-xs"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-secondary">
              Usage Notes (helps AI understand context)
            </label>
            <input
              value={usageNotes}
              onChange={(e) => setUsageNotes(e.target.value)}
              placeholder="e.g. Primary logo, use on dark backgrounds only"
              className="input w-full text-xs"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={uploading || done}
            className={`btn-primary w-full py-2.5 text-xs ${uploading || done ? "opacity-70" : ""}`}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Uploading...
              </>
            ) : done ? (
              <>
                <Check className="mr-2 h-3.5 w-3.5" />
                Done!
              </>
            ) : (
              <>
                <Upload className="mr-2 h-3.5 w-3.5" />
                Upload {files.length} file{files.length > 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
