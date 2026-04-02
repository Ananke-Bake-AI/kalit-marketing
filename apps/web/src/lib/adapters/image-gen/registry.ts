/**
 * Provider Registry — Unified access to all image & video generation providers.
 *
 * Single entry point for:
 *  - Listing available providers and their capabilities
 *  - Generating images with any provider
 *  - Generating videos with any provider
 *  - Multi-provider comparison (generate same prompt with multiple AIs)
 */

import type {
  ImageGenerationAdapter,
  ImageGenerationSpec,
  ImageResult,
  VideoGenerationAdapter,
  VideoGenerationSpec,
  VideoResult,
  ProviderInfo,
} from "../content-types";
import { MockImageAdapter } from "./mock";

// ─── Provider info catalog ──────────────────────────────────────

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "fal-flux-kontext",
    name: "Flux Kontext",
    description: "Brand-consistent image generation — maintains logos, identity, and visual style across variations. Best for brand consistency.",
    capabilities: ["text_to_image", "image_to_image", "style_transfer", "brand_consistency"],
    models: ["flux-kontext"],
    costPerImage: "$0.04",
    supportsReferenceImages: true,
    tier: "premium",
  },
  {
    id: "fal-flux-pro",
    name: "Flux Pro",
    description: "Top-tier photorealistic image generation. Best for hero images, product shots, and lifestyle imagery.",
    capabilities: ["text_to_image"],
    models: ["flux-pro-1.1"],
    costPerImage: "$0.05",
    supportsReferenceImages: false,
    tier: "premium",
  },
  {
    id: "fal-ideogram",
    name: "Ideogram 3.0",
    description: "Best text rendering in images. Perfect for ads, banners, social posts with accurate typography.",
    capabilities: ["text_to_image", "text_in_image"],
    models: ["ideogram-3.0"],
    costPerImage: "$0.03",
    supportsReferenceImages: false,
    tier: "standard",
  },
  {
    id: "fal-recraft",
    name: "Recraft V3",
    description: "Design-focused generation. Best for vector assets, icons, brand kit elements, exact color control.",
    capabilities: ["text_to_image", "vector_svg"],
    models: ["recraft-v3"],
    costPerImage: "$0.04",
    supportsReferenceImages: false,
    tier: "standard",
  },
  {
    id: "google-nano-banana-pro",
    name: "Nano Banana Pro (Direct)",
    description: "Google Gemini 3 Pro Image via direct API — same quality as fal.ai at 60% less cost. Best text rendering (94%), up to 14 reference images, 4K, person consistency.",
    capabilities: ["text_to_image", "image_to_image", "text_in_image", "style_transfer", "brand_consistency"],
    models: ["nano-banana-pro"],
    costPerImage: "$0.06",
    supportsReferenceImages: true,
    tier: "premium",
  },
  {
    id: "fal-nano-banana-pro",
    name: "Nano Banana Pro (Fal.ai)",
    description: "Google Gemini 3 Pro Image via fal.ai — easier setup, higher cost. Same model as Direct version.",
    capabilities: ["text_to_image", "image_to_image", "text_in_image", "style_transfer", "brand_consistency"],
    models: ["nano-banana-pro"],
    costPerImage: "$0.15",
    supportsReferenceImages: true,
    tier: "premium",
  },
  {
    id: "gpt-image",
    name: "GPT Image",
    description: "OpenAI's latest image model. Best for complex compositions with accurate text, infographics, and instruction-following.",
    capabilities: ["text_to_image", "text_in_image", "image_to_image"],
    models: ["gpt-image-1"],
    costPerImage: "$0.04",
    supportsReferenceImages: true,
    tier: "premium",
  },
  {
    id: "dall-e",
    name: "DALL-E 3",
    description: "OpenAI's creative image model. Good all-rounder for marketing imagery.",
    capabilities: ["text_to_image"],
    models: ["dall-e-3"],
    costPerImage: "$0.04",
    supportsReferenceImages: false,
    tier: "standard",
  },
  {
    id: "flux-replicate",
    name: "Flux (Replicate)",
    description: "Flux via Replicate. Good quality with community model support.",
    capabilities: ["text_to_image"],
    models: ["flux-1.1-pro", "flux-schnell"],
    costPerImage: "$0.05",
    supportsReferenceImages: false,
    tier: "standard",
  },
  {
    id: "fal-kling",
    name: "Kling 2.5 Pro",
    description: "High-quality AI video generation. 5-10 second clips from text or image. Best for video ads.",
    capabilities: ["video"],
    models: ["kling-2.5-pro"],
    costPerVideo: "$0.35",
    supportsReferenceImages: true,
    tier: "premium",
  },
  {
    id: "fal-minimax",
    name: "Minimax Video",
    description: "Budget-friendly video generation. Good for social media clips.",
    capabilities: ["video"],
    models: ["minimax-video-01"],
    costPerVideo: "$0.28",
    supportsReferenceImages: true,
    tier: "standard",
  },
];

// ─── Adapter instantiation ──────────────────────────────────────

function getImageAdapter(providerId: string): ImageGenerationAdapter {
  if (process.env.MOCK_ADAPTERS === "true") {
    return new MockImageAdapter();
  }

  switch (providerId) {
    case "fal-flux-pro": {
      const { FalFluxProAdapter } = require("./fal") as typeof import("./fal");
      return new FalFluxProAdapter();
    }
    case "fal-flux-kontext": {
      const { FalFluxKontextAdapter } = require("./fal") as typeof import("./fal");
      return new FalFluxKontextAdapter();
    }
    case "fal-ideogram": {
      const { FalIdeogramAdapter } = require("./fal") as typeof import("./fal");
      return new FalIdeogramAdapter();
    }
    case "fal-recraft": {
      const { FalRecraftAdapter } = require("./fal") as typeof import("./fal");
      return new FalRecraftAdapter();
    }
    case "google-nano-banana-pro": {
      const { GoogleNanoBananaProAdapter } = require("./google-gemini") as typeof import("./google-gemini");
      return new GoogleNanoBananaProAdapter();
    }
    case "fal-nano-banana-pro": {
      const { FalNanoBananaProAdapter } = require("./fal") as typeof import("./fal");
      return new FalNanoBananaProAdapter();
    }
    case "gpt-image": {
      const { GPTImageAdapter } = require("./gpt-image") as typeof import("./gpt-image");
      return new GPTImageAdapter();
    }
    case "dall-e": {
      const { DallEAdapter } = require("./dall-e") as typeof import("./dall-e");
      return new DallEAdapter();
    }
    case "flux-replicate": {
      const { FluxAdapter } = require("./flux") as typeof import("./flux");
      return new FluxAdapter({ usePro: true });
    }
    default:
      throw new Error(`Unknown image provider: ${providerId}`);
  }
}

function getVideoAdapter(providerId: string): VideoGenerationAdapter {
  switch (providerId) {
    case "fal-kling": {
      const { FalKlingVideoAdapter } = require("./fal") as typeof import("./fal");
      return new FalKlingVideoAdapter();
    }
    case "fal-minimax": {
      const { FalMinimaxVideoAdapter } = require("./fal") as typeof import("./fal");
      return new FalMinimaxVideoAdapter();
    }
    default:
      throw new Error(`Unknown video provider: ${providerId}`);
  }
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * List all available image generation providers.
 */
export function listImageProviders(): ProviderInfo[] {
  return PROVIDERS.filter((p) => !p.capabilities.includes("video"));
}

/**
 * List all available video generation providers.
 */
export function listVideoProviders(): ProviderInfo[] {
  return PROVIDERS.filter((p) => p.capabilities.includes("video"));
}

/**
 * List all providers (image + video).
 */
export function listAllProviders(): ProviderInfo[] {
  return PROVIDERS;
}

/**
 * Generate an image with a specific provider.
 */
export async function generateImage(
  providerId: string,
  spec: ImageGenerationSpec
): Promise<ImageResult> {
  const adapter = getImageAdapter(providerId);
  return adapter.generateImage(spec);
}

/**
 * Generate a video with a specific provider.
 */
export async function generateVideo(
  providerId: string,
  spec: VideoGenerationSpec
): Promise<VideoResult> {
  const adapter = getVideoAdapter(providerId);
  return adapter.generateVideo(spec);
}

/**
 * Generate with multiple providers for comparison.
 * Returns results keyed by provider ID.
 */
export async function generateComparison(
  providerIds: string[],
  spec: ImageGenerationSpec
): Promise<Record<string, ImageResult | { error: string }>> {
  const results: Record<string, ImageResult | { error: string }> = {};

  // Run all providers in parallel
  const promises = providerIds.map(async (id) => {
    try {
      const result = await generateImage(id, spec);
      results[id] = result;
    } catch (err) {
      results[id] = { error: err instanceof Error ? err.message : "Generation failed" };
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * Get the recommended provider for a given use case.
 */
export function recommendProvider(useCase: string): string {
  switch (useCase) {
    case "brand_consistency":
    case "multi_reference":
    case "person_consistency":
      return "google-nano-banana-pro";
    case "text_in_image":
    case "banner":
    case "ad_with_text":
      return "google-nano-banana-pro";
    case "photorealistic":
    case "hero_image":
    case "product_shot":
      return "fal-flux-pro";
    case "vector":
    case "icon":
    case "logo":
      return "fal-recraft";
    case "complex_composition":
    case "infographic":
      return "gpt-image";
    case "video_ad":
      return "fal-kling";
    case "budget":
      return "fal-ideogram";
    default:
      return "google-nano-banana-pro";
  }
}
