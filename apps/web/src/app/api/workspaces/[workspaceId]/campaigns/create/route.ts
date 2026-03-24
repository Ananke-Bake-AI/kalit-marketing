/**
 * Campaign Create API
 *
 * POST — Create a campaign from a natural-language prompt.
 * Claude generates the full structure (ad groups, targeting, ads) from the description.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kalit/db";
import { llmComplete, parseJSON } from "@/lib/llm/client";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

interface GeneratedCampaign {
  name: string;
  type: string;
  platform: string;
  objective: string;
  conversionEvent?: string;
  targetAudience: string;
  messagingAngle: string;
  hypothesis: string;
  dailyBudget: number;
  totalBudget: number;
  adGroups: Array<{
    name: string;
    targeting: {
      keywords?: string[];
      ageMin?: number;
      ageMax?: number;
      genders?: string[];
      locations?: string[];
      interests?: string[];
      languages?: string[];
      devices?: string[];
      followerLookalikes?: string[];
      conversationTopics?: string[];
    };
    placements?: string[];
    dailyBudget?: number;
    ads: Array<{
      headline: string;
      headlines?: string[];
      body: string;
      cta: string;
      destinationUrl: string;
      descriptions?: string[];
      messagingAngle?: string;
      tags?: string[];
    }>;
  }>;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { workspaceId } = await ctx.params;

  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const body = await req.json();
  const prompt = body.prompt as string;

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { config: true },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const config = workspace.config;
  const websiteUrl = config?.productUrl || "https://example.com";
  const productName = config?.productName || workspace.name;
  const productDesc = config?.productDescription || "";
  const industry = config?.industry || "technology";

  // Detect target platform from prompt
  const promptLower = prompt.toLowerCase();
  let detectedPlatform = "google"; // default
  if (promptLower.includes("x ads") || promptLower.includes("twitter") || promptLower.includes("promoted tweet") || promptLower.includes("x campaign") || promptLower.includes("on x")) {
    detectedPlatform = "x";
  } else if (promptLower.includes("meta") || promptLower.includes("facebook") || promptLower.includes("instagram")) {
    detectedPlatform = "meta";
  } else if (promptLower.includes("linkedin")) {
    detectedPlatform = "linkedin";
  } else if (promptLower.includes("tiktok")) {
    detectedPlatform = "tiktok";
  } else if (promptLower.includes("reddit")) {
    detectedPlatform = "reddit";
  }

  // Platform-specific instructions
  const platformInstructions: Record<string, string> = {
    google: `Platform: Google Ads
- type should be "paid_search" or "display"
- Headlines max 30 characters, descriptions max 90 characters (Google RSA format)
- Include 5+ headlines per ad in the "headlines" array for RSA rotation
- Include 3+ descriptions per ad in the "descriptions" array
- Keywords should be specific, high-intent search terms
- Include negative keyword suggestions in tags
- placements: ["search"] or ["display"] or ["search", "display"]`,

    x: `Platform: X (Twitter) Ads
- type MUST be "paid_social"
- platform MUST be "x"
- conversionEvent MUST be set. Options: "lead generation", "purchase", "download", "add to cart". Pick the most relevant for the campaign objective.
- Ad body is a tweet: compelling, conversational, max 280 characters. Use line breaks for readability. Can include emojis sparingly.
- headline is the card title (appears below tweet with link preview): max 70 characters
- cta options: "Learn More", "Sign Up", "Shop Now", "Download", "Visit Site", "Book Now"
- destinationUrl should include UTM params: ?utm_source=x&utm_medium=paid&utm_campaign={slug}

TARGETING:
- keywords: real phrases people tweet about or search on X (at least 10). Be specific. NOT hashtags.
- locations: full country names (e.g. "United States", "United Kingdom", "France") — NOT country codes
- ageMin/ageMax: realistic for the audience
- genders: ["all"] unless specific
- languages: ["English"] plus others if relevant
- devices: ["Desktop", "iOS", "Android"]

INTERESTS — CRITICAL: You MUST only use interests from X's official taxonomy below. Do NOT invent interest names.
Pick 5-10 that best match the target audience from these EXACT names:
  Technology & Computing: Computer programming, Startups, Tech news, Enterprise software, Open source, Mobile, Web design, Databases, Computer networking, Network security, SEO, Graphics software, Linux, MacOS, Windows, Tablets, Cell phones
  Business: Entrepreneurship, Small business, Marketing, Advertising, Leadership, Business news and general info, Business software, Technology, Green solutions, Investors and patents
  Science: Biology, Chemistry, Space and astronomy, Science news, Physics
  Personal Finance: Beginning investing, Investing, Stocks, Financial planning, Financial news, Real estate, Cryptocurrency
  Careers: Career news and general info, Online education, Language learning, College life
  Gaming: Computer games, Console games, Mobile games, Online games
  Sports: Running and jogging, Cycling, Soccer, NBA basketball, NFL football
  Health: Exercise and fitness
  (For other categories: Automotive, Beauty, Books, Events, Food, Home, Movies, Music, Pets, Society, Sports, Style, Travel — use the exact subcategory names from X's taxonomy)

FOLLOWER LOOKALIKES — CRITICAL: Only use real, active, verified X accounts with large followings (100K+). Format: @handle
  - Pick 4-6 accounts whose followers match the target audience
  - Use well-known accounts in the industry (founders, companies, media)
  - Do NOT use obscure or potentially inactive accounts
  - Good examples for tech: @ycombinator, @vercel, @openai, @stripe, @linear, @figma, @paulg, @levelsio, @sama
  - Verify the account is a real, major account — if unsure, pick a safer well-known alternative

CONVERSATION TOPICS: trending or evergreen topics the audience engages with on X

- Create 2-3 ad groups with different targeting angles (e.g. keyword-based, interest-based, lookalike-based)
- Each ad group should have 2-3 ad variations for A/B testing
- Budget: set dailyBudget at ad group level too`,

    meta: `Platform: Meta (Facebook/Instagram) Ads
- type should be "paid_social"
- platform MUST be "meta"
- Ad body: engaging social copy, can be longer than X (up to 500 chars). Use line breaks.
- headline: attention-grabbing, max 40 characters
- Include interests from Facebook's interest taxonomy
- locations as full country names
- Include age, gender targeting
- devices: ["mobile", "desktop"]`,

    linkedin: `Platform: LinkedIn Ads
- type should be "paid_social"
- platform MUST be "linkedin"
- Ad copy should be professional, B2B focused
- headline max 70 characters
- body: professional tone, focus on business value
- interests: professional topics (e.g. "SaaS", "Enterprise Software", "Startup")
- Include job titles, company sizes, industries in targeting where relevant`,

    tiktok: `Platform: TikTok Ads
- type should be "paid_social"
- platform MUST be "tiktok"
- Ad copy should be casual, engaging, short-form video style
- headline max 100 characters
- interests from TikTok's taxonomy`,

    reddit: `Platform: Reddit Ads
- type should be "paid_social"
- platform MUST be "reddit"
- Ad copy should match Reddit's tone: authentic, not salesy
- Target specific subreddits via interests
- headline max 300 characters`,
  };

  const platformGuide = platformInstructions[detectedPlatform] || platformInstructions.google;

  const targetGeos = config?.targetGeographies?.join(", ") || "US, UK";
  const icpDescription = config?.icpDescription || "";
  const brandVoice = config?.brandVoice || "";

  const systemPrompt = `You are an elite growth marketing architect. You create complete, ready-to-launch ad campaigns for any platform.

Given a campaign brief, generate a full campaign structure with ad groups, targeting, and ads.

${platformGuide}

General rules:
- Create compelling, specific ad copy — no generic marketing fluff
- Keywords should be specific and match user intent
- Budget should be reasonable for the campaign goal
- Destination URL should use the product website with appropriate UTM parameters
- Return ONLY valid JSON, no markdown fences
- Every field in the targeting object should be populated — the more specific the better
- The campaign must be fully deployable to ${detectedPlatform} without any manual additions

Product context:
- Name: ${productName}
- Description: ${productDesc}
- Industry: ${industry}
- Website: ${websiteUrl}
- Monthly budget: ${config?.currency || "USD"} ${config?.monthlyBudget || 5000}
- Target geographies: ${targetGeos}
${icpDescription ? `- ICP: ${icpDescription}` : ""}
${brandVoice ? `- Brand voice: ${brandVoice}` : ""}

JSON schema:
{
  "name": "string — campaign name prefixed with '${productName} — '",
  "type": "paid_search | paid_social | display | video | retargeting",
  "platform": "${detectedPlatform}",
  "objective": "awareness | traffic | engagement | leads | conversions | sales",
  "conversionEvent": "lead generation | purchase | download | add to cart — required for X/Twitter",
  "targetAudience": "string — detailed description of who we're targeting and why",
  "messagingAngle": "string — the core message and positioning",
  "hypothesis": "string — what we expect to happen and why",
  "dailyBudget": number,
  "totalBudget": number,
  "adGroups": [{
    "name": "string — descriptive name for the targeting angle",
    "dailyBudget": number,
    "targeting": {
      "keywords": ["string — at least 8-10 relevant terms"],
      "ageMin": number,
      "ageMax": number,
      "genders": ["all"],
      "locations": ["full country/region names"],
      "interests": ["string — platform-specific interests, at least 5"],
      "languages": ["English"],
      "devices": ["Desktop", "iOS", "Android"],
      "followerLookalikes": ["@handle — only for X/Twitter"],
      "conversationTopics": ["string — only for X/Twitter"]
    },
    "placements": ["string"],
    "ads": [{
      "headline": "string",
      "headlines": ["string — multiple variants for A/B testing"],
      "body": "string — the main ad copy",
      "cta": "string",
      "destinationUrl": "${websiteUrl}?utm_source=${detectedPlatform}&utm_medium=paid&utm_campaign=...",
      "descriptions": ["string — multiple variants"],
      "messagingAngle": "string",
      "tags": ["string — categories for internal tracking"]
    }]
  }]
}

Create 2-3 ad groups with 2-3 ads each. Be specific and ${detectedPlatform === "x" ? "conversational — this is Twitter, not a landing page" : "conversion-focused"}.`;

  try {
    const response = await llmComplete({
      model: "claude-sonnet-4-6",
      system: systemPrompt,
      prompt: `Create a campaign based on this brief:\n\n${prompt}`,
      maxTokens: 8192,
    });

    const generated = parseJSON<GeneratedCampaign>(response.text);

    // Persist to database
    const campaign = await prisma.campaign.create({
      data: {
        workspaceId,
        name: generated.name,
        type: (generated.type || "paid_search") as never,
        platform: generated.platform || detectedPlatform,
        objective: generated.objective || "conversions",
        status: "draft",
        targetAudience: generated.targetAudience,
        messagingAngle: generated.messagingAngle,
        hypothesis: generated.hypothesis,
        dailyBudget: generated.dailyBudget || 25,
        totalBudget: generated.totalBudget || 0,
        currency: config?.currency || "USD",
        // Store conversionEvent in platformCampaignIds JSON (generic metadata)
        platformCampaignIds: generated.conversionEvent
          ? { conversionEvent: generated.conversionEvent }
          : undefined,
      },
    });

    let totalAds = 0;

    for (const agData of generated.adGroups) {
      const adGroup = await prisma.adGroup.create({
        data: {
          campaignId: campaign.id,
          name: agData.name,
          targeting: (agData.targeting ?? {}) as object,
          placements: agData.placements ?? [],
          dailyBudget: agData.dailyBudget ?? null,
        },
      });

      for (const adData of agData.ads) {
        const creative = await prisma.creative.create({
          data: {
            workspaceId,
            type: "ad_copy",
            status: "draft",
            version: 1,
            title: adData.headline,
            content: {
              headline: adData.headline,
              headlines: adData.headlines ?? [],
              body: adData.body,
              cta: adData.cta,
              destinationUrl: adData.destinationUrl || websiteUrl,
              descriptions: adData.descriptions ?? [],
            },
            messagingAngle: adData.messagingAngle ?? null,
            tags: adData.tags ?? [],
          },
        });
        await prisma.adGroupCreative.create({
          data: {
            adGroupId: adGroup.id,
            creativeId: creative.id,
            isActive: true,
          },
        });
        totalAds++;
      }
    }

    await prisma.event.create({
      data: {
        workspaceId,
        type: "task_completed" as never,
        data: {
          action: "campaign_created_from_prompt",
          campaignId: campaign.id,
          prompt,
          adGroups: generated.adGroups.length,
          totalAds,
        },
      },
    });

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        adGroups: generated.adGroups.length,
        totalAds,
      },
    });
  } catch (err) {
    console.error("[campaign-create] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Creation failed" },
      { status: 500 }
    );
  }
}
