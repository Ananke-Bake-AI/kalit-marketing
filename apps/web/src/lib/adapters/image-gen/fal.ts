/**
 * Fal.ai Adapter — Primary aggregator for AI image & video generation.
 *
 * Supported models:
 *   Image: Flux Pro, Flux Kontext (brand consistency), Ideogram 3.0, Recraft V3
 *   Video: Kling 2.5
 *
 * All through a single FAL_KEY API key.
 */

import type {
  ImageGenerationAdapter,
  ImageGenerationSpec,
  ImageResult,
  VideoGenerationAdapter,
  VideoGenerationSpec,
  VideoResult,
} from "../content-types";

// ─── Fal.ai REST client ─────────────────────────────────────────

function getFalKey(): string {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY environment variable is required");
  return key;
}

async function falRun<T>(
  modelId: string,
  input: Record<string, unknown>
): Promise<T> {
  const key = getFalKey();

  const res = await fetch(`https://queue.fal.run/${modelId}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fal.ai ${modelId} error (${res.status}): ${err}`);
  }

  // Queue API returns request_id — poll for result
  const queueResult = (await res.json()) as { request_id?: string; images?: unknown };

  // If it's a synchronous response, return directly
  if (!queueResult.request_id) {
    return queueResult as T;
  }

  // Poll for completion
  const requestId = queueResult.request_id;
  const statusUrl = `https://queue.fal.run/${modelId}/requests/${requestId}/status`;
  const resultUrl = `https://queue.fal.run/${modelId}/requests/${requestId}`;

  for (let attempt = 0; attempt < 120; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${key}` },
    });
    const status = (await statusRes.json()) as { status: string };

    if (status.status === "COMPLETED") {
      const resultRes = await fetch(resultUrl, {
        headers: { Authorization: `Key ${key}` },
      });
      return (await resultRes.json()) as T;
    }

    if (status.status === "FAILED") {
      throw new Error(`Fal.ai ${modelId} generation failed`);
    }
  }

  throw new Error(`Fal.ai ${modelId} generation timed out`);
}

// ─── Types for fal.ai responses ─────────────────────────────────

interface FalImageResponse {
  images: Array<{ url: string; width: number; height: number; content_type?: string }>;
  prompt?: string;
  seed?: number;
}

interface FalVideoResponse {
  video: { url: string; content_type?: string };
  seed?: number;
}

// ─── Aspect ratio mapping ───────────────────────────────────────

const ASPECT_DIMS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1344, height: 768 },
  "9:16": { width: 768, height: 1344 },
  "4:5": { width: 896, height: 1120 },
};

// ─── Fal.ai model IDs ──────────────────────────────────────────

export const FAL_MODELS = {
  // Image models
  FLUX_PRO: "fal-ai/flux-pro/v1.1",
  FLUX_DEV: "fal-ai/flux/dev",
  FLUX_SCHNELL: "fal-ai/flux/schnell",
  FLUX_KONTEXT: "fal-ai/flux-pro/kontext",
  IDEOGRAM: "fal-ai/ideogram/v3",
  RECRAFT: "fal-ai/recraft-v3",
  NANO_BANANA_PRO: "fal-ai/nano-banana-pro",
  NANO_BANANA_PRO_EDIT: "fal-ai/nano-banana-pro/edit",

  // Video models
  KLING: "fal-ai/kling-video/v2.5/pro",
  MINIMAX: "fal-ai/minimax-video/video-01-live",
} as const;

// ─── Image Adapters ─────────────────────────────────────────────

/**
 * Flux Pro — High-quality photorealistic image generation via fal.ai
 */
export class FalFluxProAdapter implements ImageGenerationAdapter {
  platform = "fal-flux-pro";

  async generateImage(spec: ImageGenerationSpec): Promise<ImageResult> {
    const aspect = spec.aspectRatio ?? "1:1";
    const dims = ASPECT_DIMS[aspect];

    const input: Record<string, unknown> = {
      prompt: spec.prompt,
      image_size: { width: spec.width ?? dims.width, height: spec.height ?? dims.height },
      num_images: 1,
      enable_safety_checker: false,
    };

    const result = await falRun<FalImageResponse>(FAL_MODELS.FLUX_PRO, input);
    const img = result.images[0];

    return {
      url: img.url,
      width: img.width,
      height: img.height,
      prompt: spec.prompt,
      model: "flux-pro-1.1",
      provider: "fal",
      metadata: { seed: result.seed, aspect },
    };
  }

  async generateVariations(_imageUrl: string, count: number, prompt?: string): Promise<ImageResult[]> {
    const basePrompt = prompt ?? "Generate a creative marketing image";
    const results: ImageResult[] = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.generateImage({ prompt: `${basePrompt} (variation ${i + 1})` }));
    }
    return results;
  }
}

/**
 * Flux Kontext — Brand-consistent image generation with reference images.
 * Best for: maintaining logos, brand identity, and character consistency.
 */
export class FalFluxKontextAdapter implements ImageGenerationAdapter {
  platform = "fal-flux-kontext";

  async generateImage(spec: ImageGenerationSpec): Promise<ImageResult> {
    const aspect = spec.aspectRatio ?? "1:1";
    const dims = ASPECT_DIMS[aspect];

    const input: Record<string, unknown> = {
      prompt: spec.prompt,
      image_size: { width: spec.width ?? dims.width, height: spec.height ?? dims.height },
    };

    // Pass reference images for brand consistency
    if (spec.referenceImages?.length) {
      input.image_urls = spec.referenceImages.map((ref) => ref.url);
    }

    const result = await falRun<FalImageResponse>(FAL_MODELS.FLUX_KONTEXT, input);
    const img = result.images[0];

    return {
      url: img.url,
      width: img.width,
      height: img.height,
      prompt: spec.prompt,
      model: "flux-kontext",
      provider: "fal",
      metadata: {
        seed: result.seed,
        aspect,
        referenceCount: spec.referenceImages?.length ?? 0,
      },
    };
  }

  async generateVariations(_imageUrl: string, count: number, prompt?: string): Promise<ImageResult[]> {
    const basePrompt = prompt ?? "Generate a creative variation";
    const results: ImageResult[] = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.generateImage({ prompt: `${basePrompt} (variation ${i + 1})` }));
    }
    return results;
  }
}

/**
 * Ideogram 3.0 — Best for text-in-image and typographic creatives.
 */
export class FalIdeogramAdapter implements ImageGenerationAdapter {
  platform = "fal-ideogram";

  async generateImage(spec: ImageGenerationSpec): Promise<ImageResult> {
    const aspect = spec.aspectRatio ?? "1:1";
    const dims = ASPECT_DIMS[aspect];

    const input: Record<string, unknown> = {
      prompt: spec.prompt,
      image_size: { width: spec.width ?? dims.width, height: spec.height ?? dims.height },
      num_images: 1,
    };

    if (spec.negativePrompt) {
      input.negative_prompt = spec.negativePrompt;
    }

    if (spec.style) {
      input.style = spec.style === "photorealistic" ? "REALISTIC" : "AUTO";
    }

    const result = await falRun<FalImageResponse>(FAL_MODELS.IDEOGRAM, input);
    const img = result.images[0];

    return {
      url: img.url,
      width: img.width,
      height: img.height,
      prompt: spec.prompt,
      model: "ideogram-3.0",
      provider: "fal",
      metadata: { seed: result.seed, aspect, style: spec.style },
    };
  }

  async generateVariations(_imageUrl: string, count: number, prompt?: string): Promise<ImageResult[]> {
    const basePrompt = prompt ?? "Generate a creative typographic image";
    const results: ImageResult[] = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.generateImage({ prompt: `${basePrompt} (variation ${i + 1})` }));
    }
    return results;
  }
}

/**
 * Recraft V3 — Best for vector/SVG assets, exact color control, brand kits.
 */
export class FalRecraftAdapter implements ImageGenerationAdapter {
  platform = "fal-recraft";

  async generateImage(spec: ImageGenerationSpec): Promise<ImageResult> {
    const aspect = spec.aspectRatio ?? "1:1";
    const dims = ASPECT_DIMS[aspect];

    const input: Record<string, unknown> = {
      prompt: spec.prompt,
      image_size: { width: spec.width ?? dims.width, height: spec.height ?? dims.height },
      num_images: 1,
    };

    // Map style to Recraft's style system
    if (spec.style === "vector" || spec.style === "illustration") {
      input.style = "digital_illustration";
    } else if (spec.style === "photorealistic") {
      input.style = "realistic_image";
    }

    const result = await falRun<FalImageResponse>(FAL_MODELS.RECRAFT, input);
    const img = result.images[0];

    return {
      url: img.url,
      width: img.width,
      height: img.height,
      prompt: spec.prompt,
      model: "recraft-v3",
      provider: "fal",
      metadata: { seed: result.seed, aspect, style: spec.style },
    };
  }

  async generateVariations(_imageUrl: string, count: number, prompt?: string): Promise<ImageResult[]> {
    const basePrompt = prompt ?? "Generate a brand-consistent design asset";
    const results: ImageResult[] = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.generateImage({ prompt: `${basePrompt} (variation ${i + 1})` }));
    }
    return results;
  }
}

/**
 * Nano Banana Pro (Google Gemini 3 Pro Image) — Google's best image model.
 *
 * Best for: text rendering (94% accuracy), multi-reference composition (up to 14 images),
 * person consistency, 4K output, marketing creatives with accurate copy.
 */
export class FalNanoBananaProAdapter implements ImageGenerationAdapter {
  platform = "fal-nano-banana-pro";

  async generateImage(spec: ImageGenerationSpec): Promise<ImageResult> {
    const aspect = spec.aspectRatio ?? "1:1";
    const dims = ASPECT_DIMS[aspect];

    const input: Record<string, unknown> = {
      prompt: spec.prompt,
      image_size: { width: spec.width ?? dims.width, height: spec.height ?? dims.height },
      num_images: 1,
    };

    if (spec.negativePrompt) {
      input.negative_prompt = spec.negativePrompt;
    }

    // Nano Banana Pro supports up to 14 reference images for brand consistency
    if (spec.referenceImages?.length) {
      input.reference_images = spec.referenceImages.map((ref) => ({
        image_url: ref.url,
        weight: ref.weight ?? 0.7,
      }));
    }

    const result = await falRun<FalImageResponse>(FAL_MODELS.NANO_BANANA_PRO, input);
    const img = result.images[0];

    return {
      url: img.url,
      width: img.width,
      height: img.height,
      prompt: spec.prompt,
      model: "nano-banana-pro",
      provider: "fal",
      metadata: {
        seed: result.seed,
        aspect,
        referenceCount: spec.referenceImages?.length ?? 0,
        engine: "gemini-3-pro-image",
      },
    };
  }

  async generateVariations(_imageUrl: string, count: number, prompt?: string): Promise<ImageResult[]> {
    const basePrompt = prompt ?? "Generate a high-fidelity marketing creative";
    const results: ImageResult[] = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.generateImage({ prompt: `${basePrompt} (variation ${i + 1})` }));
    }
    return results;
  }
}

// ─── Video Adapter ──────────────────────────────────────────────

/**
 * Kling 2.5 Pro — High-quality video generation via fal.ai.
 */
export class FalKlingVideoAdapter implements VideoGenerationAdapter {
  platform = "fal-kling";

  async generateVideo(spec: VideoGenerationSpec): Promise<VideoResult> {
    const input: Record<string, unknown> = {
      prompt: spec.prompt,
      duration: spec.duration && spec.duration >= 10 ? "10" : "5",
      aspect_ratio: spec.aspectRatio ?? "16:9",
    };

    // Use reference image as first frame
    if (spec.referenceImage) {
      input.image_url = spec.referenceImage;
    }

    const result = await falRun<FalVideoResponse>(FAL_MODELS.KLING, input);

    const aspectDims = spec.aspectRatio === "9:16"
      ? { width: 720, height: 1280 }
      : spec.aspectRatio === "1:1"
        ? { width: 1080, height: 1080 }
        : { width: 1280, height: 720 };

    return {
      url: result.video.url,
      duration: spec.duration ?? 5,
      width: aspectDims.width,
      height: aspectDims.height,
      prompt: spec.prompt,
      model: "kling-2.5-pro",
      provider: "fal",
      metadata: { seed: result.seed },
    };
  }
}

/**
 * Minimax — Budget video generation via fal.ai.
 */
export class FalMinimaxVideoAdapter implements VideoGenerationAdapter {
  platform = "fal-minimax";

  async generateVideo(spec: VideoGenerationSpec): Promise<VideoResult> {
    const input: Record<string, unknown> = {
      prompt: spec.prompt,
    };

    if (spec.referenceImage) {
      input.image_url = spec.referenceImage;
    }

    const result = await falRun<FalVideoResponse>(FAL_MODELS.MINIMAX, input);

    return {
      url: result.video.url,
      duration: spec.duration ?? 5,
      width: 1280,
      height: 720,
      prompt: spec.prompt,
      model: "minimax-video-01",
      provider: "fal",
      metadata: { seed: result.seed },
    };
  }
}
