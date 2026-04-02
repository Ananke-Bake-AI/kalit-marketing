/**
 * OpenAI GPT Image Adapter — gpt-image-1 model.
 *
 * Best for: text-heavy creatives, complex compositions, instruction-following.
 * Supports reference images as input alongside text prompts.
 */

import OpenAI from "openai";
import type {
  ImageGenerationAdapter,
  ImageGenerationSpec,
  ImageResult,
} from "../content-types";

const ASPECT_TO_SIZE: Record<string, "1024x1024" | "1536x1024" | "1024x1536"> = {
  "1:1": "1024x1024",
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "4:5": "1024x1536",
};

const SIZE_DIMS: Record<string, { width: number; height: number }> = {
  "1024x1024": { width: 1024, height: 1024 },
  "1536x1024": { width: 1536, height: 1024 },
  "1024x1536": { width: 1024, height: 1536 },
};

export class GPTImageAdapter implements ImageGenerationAdapter {
  platform = "gpt-image";
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });
  }

  async generateImage(spec: ImageGenerationSpec): Promise<ImageResult> {
    const size = ASPECT_TO_SIZE[spec.aspectRatio ?? "1:1"] ?? "1024x1024";
    const dims = SIZE_DIMS[size];

    // Build a rich prompt incorporating reference image context
    let fullPrompt = spec.prompt;

    if (spec.referenceImages?.length) {
      const refDescriptions = spec.referenceImages.map((ref) => {
        const typeDesc = ref.type === "logo" ? "brand logo"
          : ref.type === "style" ? "style reference"
          : ref.type === "color_palette" ? "color palette reference"
          : ref.type === "subject" ? "subject reference"
          : "composition reference";
        return `Use the ${typeDesc} from: ${ref.url}`;
      });
      fullPrompt += `\n\nBrand references:\n${refDescriptions.join("\n")}`;
    }

    const response = await this.client.images.generate({
      model: "gpt-image-1",
      prompt: fullPrompt,
      n: 1,
      size,
      quality: spec.style === "photorealistic" ? "high" : "medium",
    });

    const imageData = response.data?.[0];
    if (!imageData) throw new Error("No image returned from GPT Image");

    // gpt-image-1 returns base64 by default — handle both URL and b64
    let url: string;
    if (imageData.url) {
      url = imageData.url;
    } else if (imageData.b64_json) {
      // Convert base64 to data URL for now; in production, store to disk
      url = `data:image/png;base64,${imageData.b64_json}`;
    } else {
      throw new Error("No image URL or base64 in GPT Image response");
    }

    return {
      url,
      width: dims.width,
      height: dims.height,
      prompt: spec.prompt,
      model: "gpt-image-1",
      provider: "openai",
      metadata: {
        size,
        quality: spec.style === "photorealistic" ? "high" : "medium",
        referenceCount: spec.referenceImages?.length ?? 0,
      },
    };
  }

  async generateVariations(
    _imageUrl: string,
    count: number,
    prompt?: string
  ): Promise<ImageResult[]> {
    const basePrompt = prompt ?? "Generate a marketing creative variation";
    const results: ImageResult[] = [];

    for (let i = 0; i < count; i++) {
      const variantPrompt = `${basePrompt}. Variation ${i + 1}: use a different visual approach while maintaining the same brand identity and message.`;
      results.push(await this.generateImage({ prompt: variantPrompt }));
    }

    return results;
  }
}
