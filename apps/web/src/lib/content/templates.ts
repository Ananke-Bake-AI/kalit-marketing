export interface AdTemplate {
  type: string;
  name: string;
  description: string;
  fields: Array<{
    name: string;
    type: "text" | "image" | "video";
    maxLength?: number;
    required: boolean;
  }>;
  platforms: string[];
  specs: {
    width?: number;
    height?: number;
    aspectRatio?: string;
    maxFileSize?: string;
  };
}

export const adTemplates: AdTemplate[] = [
  // ── Meta ──────────────────────────────────────────────
  {
    type: "meta_single_image",
    name: "Meta Single Image Ad",
    description: "Standard single image ad for Facebook/Instagram feed",
    fields: [
      { name: "primary_text", type: "text", maxLength: 125, required: true },
      { name: "headline", type: "text", maxLength: 40, required: true },
      { name: "description", type: "text", maxLength: 30, required: false },
      { name: "cta", type: "text", maxLength: 20, required: true },
      { name: "image", type: "image", required: true },
    ],
    platforms: ["meta"],
    specs: {
      width: 1080,
      height: 1080,
      aspectRatio: "1:1",
      maxFileSize: "30MB",
    },
  },
  {
    type: "meta_single_image_landscape",
    name: "Meta Single Image Ad (Landscape)",
    description: "Landscape image ad for Facebook feed",
    fields: [
      { name: "primary_text", type: "text", maxLength: 125, required: true },
      { name: "headline", type: "text", maxLength: 40, required: true },
      { name: "description", type: "text", maxLength: 30, required: false },
      { name: "cta", type: "text", maxLength: 20, required: true },
      { name: "image", type: "image", required: true },
    ],
    platforms: ["meta"],
    specs: {
      width: 1200,
      height: 628,
      aspectRatio: "1.91:1",
      maxFileSize: "30MB",
    },
  },
  {
    type: "meta_carousel",
    name: "Meta Carousel Ad",
    description: "Swipeable carousel with up to 10 cards for Facebook/Instagram",
    fields: [
      { name: "primary_text", type: "text", maxLength: 125, required: true },
      { name: "card_headline", type: "text", maxLength: 40, required: true },
      { name: "card_description", type: "text", maxLength: 20, required: false },
      { name: "card_image", type: "image", required: true },
      { name: "cta", type: "text", maxLength: 20, required: true },
    ],
    platforms: ["meta"],
    specs: {
      width: 1080,
      height: 1080,
      aspectRatio: "1:1",
      maxFileSize: "30MB",
    },
  },
  {
    type: "meta_video",
    name: "Meta Video Ad",
    description: "Video ad for Facebook/Instagram with various aspect ratios",
    fields: [
      { name: "primary_text", type: "text", maxLength: 125, required: true },
      { name: "headline", type: "text", maxLength: 40, required: true },
      { name: "description", type: "text", maxLength: 30, required: false },
      { name: "cta", type: "text", maxLength: 20, required: true },
      { name: "video", type: "video", required: true },
      { name: "thumbnail", type: "image", required: false },
    ],
    platforms: ["meta"],
    specs: {
      aspectRatio: "1:1",
      maxFileSize: "4GB",
    },
  },

  // ── Google ────────────────────────────────────────────
  {
    type: "google_responsive_search",
    name: "Google Responsive Search Ad",
    description: "Up to 15 headlines and 4 descriptions, Google auto-combines",
    fields: [
      { name: "headline", type: "text", maxLength: 30, required: true },
      { name: "description", type: "text", maxLength: 90, required: true },
      { name: "path1", type: "text", maxLength: 15, required: false },
      { name: "path2", type: "text", maxLength: 15, required: false },
      { name: "final_url", type: "text", required: true },
    ],
    platforms: ["google"],
    specs: {},
  },
  {
    type: "google_display",
    name: "Google Display Ad",
    description: "Display network ad in various standard sizes",
    fields: [
      { name: "headline", type: "text", maxLength: 30, required: true },
      { name: "long_headline", type: "text", maxLength: 90, required: true },
      { name: "description", type: "text", maxLength: 90, required: true },
      { name: "image", type: "image", required: true },
      { name: "logo", type: "image", required: false },
    ],
    platforms: ["google"],
    specs: {
      width: 1200,
      height: 628,
      aspectRatio: "1.91:1",
      maxFileSize: "5MB",
    },
  },

  // ── TikTok ────────────────────────────────────────────
  {
    type: "tiktok_in_feed",
    name: "TikTok In-Feed Video Ad",
    description: "Vertical video ad appearing in TikTok For You feed (15-60s)",
    fields: [
      { name: "ad_text", type: "text", maxLength: 100, required: true },
      { name: "cta", type: "text", maxLength: 20, required: true },
      { name: "video", type: "video", required: true },
    ],
    platforms: ["tiktok"],
    specs: {
      width: 1080,
      height: 1920,
      aspectRatio: "9:16",
      maxFileSize: "500MB",
    },
  },

  // ── LinkedIn ──────────────────────────────────────────
  {
    type: "linkedin_single_image",
    name: "LinkedIn Single Image Ad",
    description: "Sponsored content with a single image in the LinkedIn feed",
    fields: [
      { name: "introductory_text", type: "text", maxLength: 600, required: true },
      { name: "headline", type: "text", maxLength: 200, required: true },
      { name: "description", type: "text", maxLength: 300, required: false },
      { name: "cta", type: "text", maxLength: 20, required: true },
      { name: "image", type: "image", required: true },
    ],
    platforms: ["linkedin"],
    specs: {
      width: 1200,
      height: 627,
      aspectRatio: "1.91:1",
      maxFileSize: "5MB",
    },
  },

  // ── X / Twitter ───────────────────────────────────────
  {
    type: "x_promoted_tweet",
    name: "X/Twitter Promoted Tweet",
    description: "Promoted tweet with optional image for X timeline",
    fields: [
      { name: "tweet_text", type: "text", maxLength: 280, required: true },
      { name: "image", type: "image", required: false },
      { name: "card_title", type: "text", maxLength: 70, required: false },
      { name: "card_description", type: "text", maxLength: 200, required: false },
    ],
    platforms: ["x"],
    specs: {
      width: 1200,
      height: 675,
      aspectRatio: "16:9",
      maxFileSize: "5MB",
    },
  },

  // ── Reddit ────────────────────────────────────────────
  {
    type: "reddit_promoted_post",
    name: "Reddit Promoted Post",
    description: "Promoted post appearing in subreddit feeds",
    fields: [
      { name: "headline", type: "text", maxLength: 300, required: true },
      { name: "body_text", type: "text", maxLength: 40000, required: false },
      { name: "cta", type: "text", maxLength: 20, required: true },
      { name: "thumbnail", type: "image", required: false },
    ],
    platforms: ["reddit"],
    specs: {
      width: 1200,
      height: 628,
      aspectRatio: "1.91:1",
      maxFileSize: "10MB",
    },
  },

  // ── Instagram Story ───────────────────────────────────
  {
    type: "instagram_story",
    name: "Instagram Story Ad",
    description: "Full-screen vertical ad between Instagram Stories",
    fields: [
      { name: "headline", type: "text", maxLength: 40, required: false },
      { name: "cta", type: "text", maxLength: 20, required: true },
      { name: "image", type: "image", required: true },
    ],
    platforms: ["meta"],
    specs: {
      width: 1080,
      height: 1920,
      aspectRatio: "9:16",
      maxFileSize: "30MB",
    },
  },

  // ── Email ─────────────────────────────────────────────
  {
    type: "email_template",
    name: "Email Campaign Template",
    description: "Marketing email with header image, body copy, and CTA button",
    fields: [
      { name: "subject_line", type: "text", maxLength: 150, required: true },
      { name: "preview_text", type: "text", maxLength: 200, required: true },
      { name: "header_image", type: "image", required: false },
      { name: "headline", type: "text", maxLength: 100, required: true },
      { name: "body", type: "text", maxLength: 5000, required: true },
      { name: "cta_text", type: "text", maxLength: 30, required: true },
      { name: "cta_url", type: "text", required: true },
    ],
    platforms: ["email"],
    specs: {
      width: 600,
      maxFileSize: "1MB",
    },
  },
];

/**
 * Get templates filtered by platform.
 */
export function getTemplatesForPlatform(platform: string): AdTemplate[] {
  return adTemplates.filter((t) => t.platforms.includes(platform));
}

/**
 * Get a specific template by type.
 */
export function getTemplate(type: string): AdTemplate | undefined {
  return adTemplates.find((t) => t.type === type);
}
