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
// Platform detection is handled client-side via /api/platform-keys/connected
// The client passes targetPlatforms in the request body

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

  // Determine target platforms:
  // 1. If body.platform is specified (adapt mode or explicit), use that
  // 2. If body.platforms is an array (from frontend connected platforms check), use those
  // 3. If user mentions a platform in the prompt, use that
  // 4. Otherwise, default to ["x"] (always available via extension)
  const promptLower = prompt.toLowerCase();

  let targetPlatforms: string[] = [];

  if (body.platform) {
    targetPlatforms = [body.platform];
  } else if (Array.isArray(body.platforms) && body.platforms.length > 0) {
    targetPlatforms = body.platforms;
  } else if (promptLower.includes("x ads") || promptLower.includes("twitter") || promptLower.includes("on x")) {
    targetPlatforms = ["x"];
  } else if (promptLower.includes("meta") || promptLower.includes("facebook") || promptLower.includes("instagram")) {
    targetPlatforms = ["meta"];
  } else if (promptLower.includes("linkedin")) {
    targetPlatforms = ["linkedin"];
  } else if (promptLower.includes("tiktok")) {
    targetPlatforms = ["tiktok"];
  } else if (promptLower.includes("google")) {
    targetPlatforms = ["google"];
  } else {
    // No platform specified and no platforms passed — default to x (always available)
    targetPlatforms = ["x"];
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

  const targetGeos = config?.targetGeographies?.join(", ") || "US, UK";
  const icpDescription = config?.icpDescription || "";
  const brandVoice = config?.brandVoice || "";

  const createdCampaigns: { id: string; name: string; platform: string; adGroups: number; totalAds: number }[] = [];

  // Generate a campaign for each target platform
  for (const targetPlatform of targetPlatforms) {
    const platformGuide = platformInstructions[targetPlatform] || platformInstructions.google;

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
- The campaign must be fully deployable to ${targetPlatform} without any manual additions

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
  "platform": "${targetPlatform}",
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
      "destinationUrl": "${websiteUrl}?utm_source=${targetPlatform}&utm_medium=paid&utm_campaign=...",
      "descriptions": ["string — multiple variants"],
      "messagingAngle": "string",
      "tags": ["string — categories for internal tracking"]
    }]
  }]
}

DEFAULT CAMPAIGN STRUCTURE (use these ONLY if the user's brief doesn't specify a different structure):
${targetPlatform === "google" ? `Google Ads defaults:
- 1 campaign, 1-2 ad groups (one per keyword theme — tight grouping)
- Each ad group: 1 RSA with 10-15 headlines and 4 descriptions — Google rotates
- 10-20 tightly related keywords per group` :
targetPlatform === "x" ? `X Ads defaults:
- 1 ad group, 2-3 promoted tweet variations (different hooks, same targeting)
- Conversational, punchy — this is Twitter, not a landing page
- Combined targeting: keywords + interests + lookalikes in one group` :
targetPlatform === "meta" ? `Meta Ads defaults:
- 1-2 ad sets (audiences), 3-5 ad variations per set
- Meta's algorithm optimizes delivery — give it creative options
- Broad audiences work better than many narrow ones` :
targetPlatform === "linkedin" ? `LinkedIn Ads defaults:
- 1 ad group, 2-4 ad variations
- Professional value proposition, tight targeting` :
targetPlatform === "tiktok" ? `TikTok Ads defaults:
- 1-2 ad groups, 3-5 variations per group
- Short, authentic, attention-grabbing copy` :
`1-2 ad groups, 2-3 ads each.`}

IMPORTANT: If the user's brief specifies a number of ads, ad groups, or a specific structure, follow their instructions exactly — do NOT override with the defaults above. The defaults are only for when the user doesn't specify.

Return ONLY valid JSON matching the schema above.`;

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
        platform: generated.platform || targetPlatform,
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
          platform: targetPlatform,
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
          platform: targetPlatform,
          prompt,
          adGroups: generated.adGroups.length,
          totalAds,
        },
      },
    });

    createdCampaigns.push({
      id: campaign.id,
      name: campaign.name,
      platform: targetPlatform,
      adGroups: generated.adGroups.length,
      totalAds,
    });

    } catch (err) {
      console.error(`[campaign-create] Error for ${targetPlatform}:`, err);
      // Continue with other platforms even if one fails
      createdCampaigns.push({
        id: "",
        name: `Failed: ${targetPlatform}`,
        platform: targetPlatform,
        adGroups: 0,
        totalAds: 0,
      });
    }
  } // end for (targetPlatforms)

  if (createdCampaigns.length === 0 || createdCampaigns.every(c => !c.id)) {
    return NextResponse.json(
      { error: "Campaign creation failed for all platforms" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    platforms: targetPlatforms,
    campaigns: createdCampaigns.filter(c => c.id),
    campaign: createdCampaigns.find(c => c.id) || null,
  });
}
