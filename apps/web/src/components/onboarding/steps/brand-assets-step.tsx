"use client";

import { useState } from "react";
import {
  FolderOpen,
  Upload,
  Check,
  ArrowRight,
  ArrowLeft,
  Image,
  FileText,
} from "lucide-react";
import { AssetUpload } from "@/components/dashboard/asset-upload";

interface BrandAssetsStepProps {
  workspaceId: string;
  assetsCount: number;
  onComplete: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function BrandAssetsStep({
  workspaceId,
  assetsCount,
  onComplete,
  onBack,
  onSkip,
}: BrandAssetsStepProps) {
  const [uploadedCount, setUploadedCount] = useState(assetsCount);
  const [showUpload, setShowUpload] = useState(assetsCount === 0);

  const hasAssets = uploadedCount > 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center border border-accent/30 bg-accent/10">
            <FolderOpen className="h-4 w-4 text-accent" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-text">
            Brand Assets
          </h2>
        </div>
        <p className="text-sm text-text-secondary">
          Upload your startup&apos;s visual identity — logos, product screenshots, brand images.
          Our AI uses these to generate on-brand marketing creatives that actually look like your company.
        </p>
      </div>

      {/* What to upload guide */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            icon: Image,
            title: "Logo & Mark",
            desc: "Primary logo, icon mark, wordmark. Dark and light versions if available.",
            category: "logo",
          },
          {
            icon: Image,
            title: "Product Images",
            desc: "Screenshots, product photos, UI mockups. What your product looks like.",
            category: "product_screenshot",
          },
          {
            icon: FileText,
            title: "Brand Materials",
            desc: "Social media banners, ad templates, color swatches, brand guide.",
            category: "brand_image",
          },
        ].map((item) => (
          <div key={item.category} className="border border-divider bg-transparent p-4">
            <item.icon className="mb-2 h-5 w-5 text-text-secondary" />
            <p className="text-xs font-semibold text-text">{item.title}</p>
            <p className="mt-1 text-[10px] text-text-secondary">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Status */}
      {hasAssets && (
        <div className="mb-4 flex items-center gap-2 border border-emerald-500/20 bg-emerald-500/10 p-3">
          <Check className="h-4 w-4 text-emerald-600" />
          <span className="text-xs text-emerald-300">
            {uploadedCount} asset{uploadedCount > 1 ? "s" : ""} uploaded
          </span>
          {!showUpload && (
            <button
              onClick={() => setShowUpload(true)}
              className="ml-auto text-[10px] text-emerald-600 hover:text-emerald-300"
            >
              + Upload more
            </button>
          )}
        </div>
      )}

      {/* Upload area */}
      {showUpload && (
        <div className="mb-6">
          <AssetUpload
            workspaceId={workspaceId}
            onUploaded={() => {
              setUploadedCount((c) => c + 1);
              setShowUpload(false);
            }}
          />
        </div>
      )}

      {!showUpload && !hasAssets && (
        <button
          onClick={() => setShowUpload(true)}
          className="mb-6 flex w-full items-center justify-center gap-2 border border-dashed border-divider py-8 text-sm text-text-secondary hover:border-accent/30 hover:text-accent"
        >
          <Upload className="h-5 w-5" />
          Upload Brand Assets
        </button>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onBack}
          className="btn-secondary px-4 py-2 text-[10px]"
        >
          <ArrowLeft className="mr-1.5 h-3 w-3" />
          Back
        </button>

        <div className="flex gap-2">
          <button
            onClick={onSkip}
            className="px-3 py-2 text-[10px] text-text-secondary hover:text-text-secondary"
          >
            Skip for now
          </button>
          <button
            onClick={onComplete}
            className={`btn-primary px-4 py-2 text-[10px] ${!hasAssets ? "opacity-50" : ""}`}
          >
            {hasAssets ? "Continue" : "Upload first"}
            <ArrowRight className="ml-1.5 h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
