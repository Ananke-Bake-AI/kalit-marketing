// ─── Image Generation ────────────────────────────────────────────

export interface ImageGenerationSpec {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  style?: string; // e.g. "photorealistic", "illustration", "3d", "vector"
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:5";
  numVariations?: number;

  // Brand asset references — pass uploaded images for style/identity transfer
  referenceImages?: ReferenceImage[];
}

export interface ReferenceImage {
  url: string; // URL of the uploaded brand asset
  type: "style" | "subject" | "logo" | "color_palette" | "composition";
  weight?: number; // 0-1, how strongly to apply this reference (default 0.7)
}

export interface ImageResult {
  url: string;
  width: number;
  height: number;
  prompt: string;
  model: string;
  provider: string;
  metadata?: Record<string, unknown>;
}

export interface ImageGenerationAdapter {
  platform: string;
  generateImage(spec: ImageGenerationSpec): Promise<ImageResult>;
  generateVariations(imageUrl: string, count: number, prompt?: string): Promise<ImageResult[]>;
}

// ─── Video Generation ────────────────────────────────────────────

export interface VideoGenerationSpec {
  prompt: string;
  referenceImage?: string; // image URL to use as first frame / style reference
  duration?: number; // seconds (default 5)
  aspectRatio?: "16:9" | "9:16" | "1:1";
  style?: string;
}

export interface VideoResult {
  url: string;
  duration: number;
  width: number;
  height: number;
  prompt: string;
  model: string;
  provider: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface VideoGenerationAdapter {
  platform: string;
  generateVideo(spec: VideoGenerationSpec): Promise<VideoResult>;
}

// ─── Provider Registry ───────────────────────────────────────────

export type ProviderCapability = "text_to_image" | "image_to_image" | "style_transfer" | "text_in_image" | "vector_svg" | "video" | "brand_consistency";

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  capabilities: ProviderCapability[];
  models: string[];
  costPerImage?: string; // human-readable like "$0.03"
  costPerVideo?: string;
  supportsReferenceImages: boolean;
  tier: "budget" | "standard" | "premium";
}
