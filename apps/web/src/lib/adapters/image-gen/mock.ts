import type { ImageGenerationAdapter, ImageGenerationSpec, ImageResult } from "../content-types";

const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1792, height: 1024 },
  "9:16": { width: 1024, height: 1792 },
  "4:5": { width: 1024, height: 1280 },
};

export class MockImageAdapter implements ImageGenerationAdapter {
  platform = "mock";

  async generateImage(spec: ImageGenerationSpec): Promise<ImageResult> {
    const dimensions = ASPECT_RATIO_DIMENSIONS[spec.aspectRatio ?? "1:1"] ?? {
      width: spec.width ?? 1024,
      height: spec.height ?? 1024,
    };

    const width = spec.width ?? dimensions.width;
    const height = spec.height ?? dimensions.height;

    // Use picsum.photos for placeholder images with a random seed
    const seed = Math.floor(Math.random() * 10000);
    const url = `https://picsum.photos/seed/${seed}/${width}/${height}`;

    return {
      url,
      width,
      height,
      prompt: spec.prompt,
      model: "mock",
      metadata: {
        style: spec.style,
        aspectRatio: spec.aspectRatio,
        seed,
        isMock: true,
      },
    };
  }

  async generateVariations(
    _imageUrl: string,
    count: number,
    prompt?: string
  ): Promise<ImageResult[]> {
    const results: ImageResult[] = [];

    for (let i = 0; i < count; i++) {
      const seed = Math.floor(Math.random() * 10000);
      const width = 1024;
      const height = 1024;

      results.push({
        url: `https://picsum.photos/seed/${seed}/${width}/${height}`,
        width,
        height,
        prompt: prompt ?? `Mock variation ${i + 1}`,
        model: "mock",
        metadata: { seed, variation: i + 1, isMock: true },
      });
    }

    return results;
  }
}

export const mockImageAdapter = new MockImageAdapter();
