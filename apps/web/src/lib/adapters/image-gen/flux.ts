import Replicate from "replicate";
import type { ImageGenerationAdapter, ImageGenerationSpec, ImageResult } from "../content-types";

const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1344, height: 768 },
  "9:16": { width: 768, height: 1344 },
  "4:5": { width: 896, height: 1120 },
};

const PRO_MODEL = "black-forest-labs/flux-1.1-pro" as const;
const SCHNELL_MODEL = "black-forest-labs/flux-schnell" as const;

export class FluxAdapter implements ImageGenerationAdapter {
  platform = "flux";
  private client: Replicate;
  private model: string;

  constructor(options?: { apiToken?: string; usePro?: boolean }) {
    this.client = new Replicate({
      auth: options?.apiToken ?? process.env.REPLICATE_API_TOKEN,
    });
    this.model = options?.usePro ? PRO_MODEL : SCHNELL_MODEL;
  }

  async generateImage(spec: ImageGenerationSpec): Promise<ImageResult> {
    const aspectRatio = spec.aspectRatio ?? "1:1";
    const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio];

    const input: Record<string, unknown> = {
      prompt: spec.prompt,
      aspect_ratio: aspectRatio,
    };

    if (spec.negativePrompt) {
      input.negative_prompt = spec.negativePrompt;
    }

    if (spec.width && spec.height) {
      input.width = spec.width;
      input.height = spec.height;
    }

    const output = await this.client.run(this.model as `${string}/${string}`, { input });

    // Replicate returns either a string URL or an array of URLs
    let url: string;
    if (Array.isArray(output)) {
      url = String(output[0]);
    } else if (typeof output === "string") {
      url = output;
    } else {
      // ReadableStream or other output — convert to string
      url = String(output);
    }

    return {
      url,
      width: spec.width ?? dimensions.width,
      height: spec.height ?? dimensions.height,
      prompt: spec.prompt,
      model: this.model,
      metadata: {
        aspectRatio,
        style: spec.style,
      },
    };
  }

  async generateVariations(
    _imageUrl: string,
    count: number,
    prompt?: string
  ): Promise<ImageResult[]> {
    const basePrompt = prompt ?? "Generate a creative variation";
    const results: ImageResult[] = [];

    for (let i = 0; i < count; i++) {
      // Use different seeds to produce variations
      const seed = Math.floor(Math.random() * 2147483647);
      const variantPrompt = `${basePrompt} (variation ${i + 1}, seed: ${seed})`;

      const aspectRatio = "1:1" as const;
      const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio];

      const input: Record<string, unknown> = {
        prompt: variantPrompt,
        aspect_ratio: aspectRatio,
        seed,
      };

      const output = await this.client.run(this.model as `${string}/${string}`, { input });

      let url: string;
      if (Array.isArray(output)) {
        url = String(output[0]);
      } else if (typeof output === "string") {
        url = output;
      } else {
        url = String(output);
      }

      results.push({
        url,
        width: dimensions.width,
        height: dimensions.height,
        prompt: variantPrompt,
        model: this.model,
        metadata: { seed, variation: i + 1 },
      });
    }

    return results;
  }
}

export const fluxAdapter = new FluxAdapter();
