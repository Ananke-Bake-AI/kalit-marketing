export interface ImageGenerationSpec {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  style?: string; // e.g. "photorealistic", "illustration", "3d"
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:5";
  numVariations?: number;
}

export interface ImageResult {
  url: string;
  width: number;
  height: number;
  prompt: string;
  model: string;
  metadata?: Record<string, unknown>;
}

export interface ImageGenerationAdapter {
  platform: string;
  generateImage(spec: ImageGenerationSpec): Promise<ImageResult>;
  generateVariations(imageUrl: string, count: number, prompt?: string): Promise<ImageResult[]>;
}
