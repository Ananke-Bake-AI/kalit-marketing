import OpenAI from "openai";
import type { ImageGenerationAdapter, ImageGenerationSpec, ImageResult } from "../content-types";

const ASPECT_RATIO_TO_SIZE: Record<string, "1024x1024" | "1792x1024" | "1024x1792"> = {
  "1:1": "1024x1024",
  "16:9": "1792x1024",
  "9:16": "1024x1792",
  "4:5": "1024x1792",
};

const SIZE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "1024x1024": { width: 1024, height: 1024 },
  "1792x1024": { width: 1792, height: 1024 },
  "1024x1792": { width: 1024, height: 1792 },
};

export class DallEAdapter implements ImageGenerationAdapter {
  platform = "dall-e";
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });
  }

  async generateImage(spec: ImageGenerationSpec): Promise<ImageResult> {
    const size = ASPECT_RATIO_TO_SIZE[spec.aspectRatio ?? "1:1"] ?? "1024x1024";
    const dimensions = SIZE_DIMENSIONS[size];

    // Map style to DALL-E quality/style params
    const quality: "standard" | "hd" = spec.style === "photorealistic" ? "hd" : "standard";
    const style: "vivid" | "natural" = spec.style === "photorealistic" ? "natural" : "vivid";

    const response = await this.client.images.generate({
      model: "dall-e-3",
      prompt: spec.prompt,
      n: 1,
      size,
      quality,
      style,
    });

    const imageData = response.data?.[0];
    if (!imageData) throw new Error("No image returned from DALL-E");

    return {
      url: imageData.url!,
      width: dimensions.width,
      height: dimensions.height,
      prompt: imageData.revised_prompt ?? spec.prompt,
      model: "dall-e-3",
      provider: "openai",
      metadata: {
        quality,
        style,
        size,
        revisedPrompt: imageData.revised_prompt,
      },
    };
  }

  async generateVariations(
    _imageUrl: string,
    count: number,
    prompt?: string
  ): Promise<ImageResult[]> {
    // DALL-E 3 doesn't support image-based variations directly,
    // so we generate multiple images with slight prompt modifications
    const basePrompt = prompt ?? "Generate a variation of the original image";
    const variationSuffixes = [
      "with a slightly different composition",
      "with an alternative color palette",
      "from a different angle or perspective",
      "with modified lighting and mood",
      "with a fresh artistic interpretation",
    ];

    const results: ImageResult[] = [];

    for (let i = 0; i < count; i++) {
      const suffix = variationSuffixes[i % variationSuffixes.length];
      const variantPrompt = `${basePrompt}, ${suffix}`;

      const result = await this.generateImage({
        prompt: variantPrompt,
        aspectRatio: "1:1",
      });

      results.push(result);
    }

    return results;
  }
}

export const dallEAdapter = new DallEAdapter();
