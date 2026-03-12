/**
 * Seed script — populates the database with realistic mock data.
 * Run with: pnpm db:seed
 */

import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.round(rand(min, max));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("🌱 Seeding database...\n");

  // Clean existing data
  await prisma.event.deleteMany();
  await prisma.memory.deleteMany();
  await prisma.task.deleteMany();
  await prisma.experiment.deleteMany();
  await prisma.adGroupCreative.deleteMany();
  await prisma.creative.deleteMany();
  await prisma.adGroup.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.connectedAccount.deleteMany();
  await prisma.workspaceConfig.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  // ─── Demo user ────────────────────────────────────────────────
  const demoUser = await prisma.user.create({
    data: {
      email: "admin@kalit.ai",
      name: "Kalit Admin",
      password: hashSync("kalit2024", 12),
    },
  });
  console.log(`✅ Demo user: admin@kalit.ai / kalit2024\n`);

  // ─── Workspace 1: Active SaaS startup (monitoring phase) ────
  const ws1 = await prisma.workspace.create({
    data: {
      name: "FlowMetrics",
      slug: "flowmetrics",
      status: "monitoring",
    },
  });

  await prisma.workspaceConfig.create({
    data: {
      workspaceId: ws1.id,
      productName: "FlowMetrics",
      productDescription:
        "Analytics dashboard for SaaS companies that tracks MRR, churn, LTV, and cohort analysis in real-time. Integrates with Stripe, Chargebee, and Recurly.",
      productUrl: "https://flowmetrics.io",
      industry: "SaaS / Analytics",
      stage: "growth",
      icpDescription:
        "SaaS founders and VPs of Growth at Series A-B startups ($1M-$20M ARR) who need real-time subscription analytics without building a data team.",
      brandVoice:
        "Clear, data-driven, slightly nerdy but approachable. We speak metrics fluently.",
      monthlyBudget: 15000,
      primaryGoal: "signups",
      targetCac: 45,
      targetRoas: 3.5,
      autonomyMode: "guardrailed",
      targetGeographies: ["US", "UK", "CA", "AU"],
    },
  });

  // Connected accounts for FlowMetrics
  await prisma.connectedAccount.createMany({
    data: [
      {
        workspaceId: ws1.id,
        platform: "meta",
        accountId: "act_mock_fm_meta",
        accountName: "FlowMetrics - Meta Ads",
        credentials: { accessToken: "mock_token_meta", refreshToken: "mock_refresh" },
        scopes: ["ads_management", "ads_read"],
        isActive: true,
        lastSyncAt: daysAgo(0),
      },
      {
        workspaceId: ws1.id,
        platform: "google",
        accountId: "mock_fm_google_123",
        accountName: "FlowMetrics - Google Ads",
        credentials: { accessToken: "mock_token_google", refreshToken: "mock_refresh" },
        scopes: ["adwords"],
        isActive: true,
        lastSyncAt: daysAgo(0),
      },
      {
        workspaceId: ws1.id,
        platform: "ga4",
        accountId: "mock_fm_ga4",
        accountName: "FlowMetrics - GA4",
        credentials: { accessToken: "mock_token_ga4" },
        scopes: ["analytics.readonly"],
        isActive: true,
        lastSyncAt: daysAgo(1),
      },
    ],
  });

  // Campaigns for FlowMetrics
  const fmCampaigns = await Promise.all([
    prisma.campaign.create({
      data: {
        workspaceId: ws1.id,
        name: "SaaS Founders — Meta Prospecting",
        type: "paid_social",
        status: "active",
        objective: "conversions",
        targetAudience: "SaaS founders, 25-45, US/UK",
        messagingAngle: "Stop guessing your metrics — see them in real-time",
        dailyBudget: 150,
        totalBudget: 4500,
        platformCampaignIds: { meta: "mock_camp_fm_1" },
        impressions: randInt(120000, 200000),
        clicks: randInt(3500, 6000),
        conversions: randInt(140, 280),
        spend: rand(2800, 4200),
        revenue: rand(8500, 16000),
        ctr: rand(0.025, 0.04),
        cpc: rand(0.65, 1.2),
        cpa: rand(18, 35),
        roas: rand(2.8, 4.2),
      },
    }),
    prisma.campaign.create({
      data: {
        workspaceId: ws1.id,
        name: "Subscription Analytics — Google Search",
        type: "paid_search",
        status: "active",
        objective: "conversions",
        targetAudience: "People searching for SaaS analytics tools",
        messagingAngle: "The analytics dashboard your SaaS deserves",
        dailyBudget: 200,
        totalBudget: 6000,
        platformCampaignIds: { google: "mock_camp_fm_2" },
        impressions: randInt(80000, 150000),
        clicks: randInt(4000, 8000),
        conversions: randInt(200, 400),
        spend: rand(3500, 5500),
        revenue: rand(12000, 22000),
        ctr: rand(0.04, 0.06),
        cpc: rand(0.8, 1.5),
        cpa: rand(14, 28),
        roas: rand(3.0, 4.5),
      },
    }),
    prisma.campaign.create({
      data: {
        workspaceId: ws1.id,
        name: "Retargeting — Website Visitors",
        type: "retargeting",
        status: "optimizing",
        objective: "conversions",
        dailyBudget: 75,
        totalBudget: 2250,
        platformCampaignIds: { meta: "mock_camp_fm_3" },
        impressions: randInt(40000, 80000),
        clicks: randInt(1200, 2400),
        conversions: randInt(90, 180),
        spend: rand(900, 1800),
        revenue: rand(5000, 12000),
        ctr: rand(0.02, 0.035),
        cpc: rand(0.5, 1.0),
        cpa: rand(10, 20),
        roas: rand(4.0, 7.0),
      },
    }),
    prisma.campaign.create({
      data: {
        workspaceId: ws1.id,
        name: "LinkedIn Thought Leadership",
        type: "organic_social",
        status: "active",
        objective: "awareness",
        dailyBudget: 50,
        impressions: randInt(15000, 30000),
        clicks: randInt(400, 900),
        conversions: randInt(15, 40),
        spend: rand(400, 800),
        revenue: rand(800, 2000),
        ctr: rand(0.02, 0.04),
        roas: rand(1.5, 3.0),
      },
    }),
    prisma.campaign.create({
      data: {
        workspaceId: ws1.id,
        name: "SEO Content — MRR Guides",
        type: "seo_content",
        status: "active",
        objective: "traffic",
        impressions: randInt(25000, 60000),
        clicks: randInt(2000, 5000),
        conversions: randInt(50, 120),
        spend: 0,
        revenue: rand(2000, 5000),
      },
    }),
  ]);

  // Creatives for FlowMetrics
  const fmCreatives = await Promise.all([
    prisma.creative.create({
      data: {
        workspaceId: ws1.id,
        type: "ad_copy",
        status: "active",
        title: "Stop guessing your SaaS metrics",
        content: {
          headline: "Stop Guessing Your SaaS Metrics",
          body: "FlowMetrics gives you real-time MRR, churn, and LTV analytics. Connect Stripe in 30 seconds.",
          cta: "Start Free Trial",
        },
        messagingAngle: "Pain point: guessing metrics",
        impressions: randInt(80000, 150000),
        clicks: randInt(2500, 5000),
        conversions: randInt(100, 200),
        tags: ["prospecting", "pain-point", "meta"],
      },
    }),
    prisma.creative.create({
      data: {
        workspaceId: ws1.id,
        type: "headline",
        status: "active",
        title: "See Your MRR in Real-Time",
        content: {
          headline: "See Your MRR in Real-Time",
          description: "Join 2,000+ SaaS companies tracking metrics that matter",
        },
        impressions: randInt(50000, 100000),
        clicks: randInt(2000, 4000),
        conversions: randInt(80, 160),
        tags: ["search", "benefit-driven", "google"],
      },
    }),
    prisma.creative.create({
      data: {
        workspaceId: ws1.id,
        type: "ad_copy",
        status: "fatigued",
        title: "Your SaaS Dashboard is Broken",
        content: {
          headline: "Your SaaS Dashboard is Broken",
          body: "Spreadsheets and custom SQL queries aren't cutting it. FlowMetrics does what Mixpanel can't.",
          cta: "Fix It Now",
        },
        messagingAngle: "Competitive angle",
        impressions: randInt(120000, 200000),
        clicks: randInt(1500, 3000),
        conversions: randInt(40, 80),
        fatigueScore: 0.72,
        tags: ["competitive", "fatigued", "meta"],
      },
    }),
  ]);

  // Ad groups linking campaigns to creatives
  const ag1 = await prisma.adGroup.create({
    data: {
      campaignId: fmCampaigns[0].id,
      name: "Prospecting — SaaS Founders 25-45",
      targeting: { ageRange: "25-45", interests: ["SaaS", "Startup"], geos: ["US", "UK"] },
      dailyBudget: 150,
      impressions: randInt(100000, 180000),
      clicks: randInt(3000, 5500),
      conversions: randInt(120, 250),
      spend: rand(2500, 4000),
    },
  });

  await prisma.adGroupCreative.createMany({
    data: [
      {
        adGroupId: ag1.id,
        creativeId: fmCreatives[0].id,
        isActive: true,
        impressions: randInt(50000, 90000),
        clicks: randInt(1500, 2800),
        conversions: randInt(60, 130),
        spend: rand(1200, 2000),
      },
      {
        adGroupId: ag1.id,
        creativeId: fmCreatives[2].id,
        isActive: false,
        impressions: randInt(50000, 90000),
        clicks: randInt(800, 1500),
        conversions: randInt(30, 60),
        spend: rand(1000, 1800),
      },
    ],
  });

  // Experiments for FlowMetrics
  await prisma.experiment.create({
    data: {
      workspaceId: ws1.id,
      name: "Pain Point vs Benefit Headlines",
      status: "running",
      hypothesis:
        "Pain-point messaging ('Stop guessing') will outperform benefit messaging ('See your MRR') by 15% on conversion rate",
      successMetric: "conversion_rate",
      targetConfidence: 0.95,
      startedAt: daysAgo(8),
      campaigns: { connect: [{ id: fmCampaigns[0].id }, { id: fmCampaigns[1].id }] },
    },
  });

  await prisma.experiment.create({
    data: {
      workspaceId: ws1.id,
      name: "Retargeting Window Test",
      status: "completed",
      hypothesis: "7-day retargeting window will have lower CPA than 30-day window",
      successMetric: "cpa",
      targetConfidence: 0.95,
      confidence: 0.97,
      winnerVariant: "7-day window",
      learnings: "7-day window had 23% lower CPA. Users who don't convert within a week are unlikely to convert from retargeting alone.",
      startedAt: daysAgo(21),
      completedAt: daysAgo(3),
    },
  });

  // Tasks for FlowMetrics
  await prisma.task.createMany({
    data: [
      {
        workspaceId: ws1.id,
        title: "Daily performance review",
        family: "review",
        agentType: "performance_analyst",
        trigger: "scheduled",
        status: "completed",
        reason: "Scheduled daily review",
        startedAt: daysAgo(0),
        completedAt: daysAgo(0),
        output: { summary: "All campaigns performing within target ranges. ROAS at 3.4x overall." },
      },
      {
        workspaceId: ws1.id,
        title: "Rotate fatigued creative — competitive angle",
        family: "production",
        agentType: "creative_strategist",
        trigger: "event",
        status: "executing",
        reason: "Creative fatigue detected on 'Your SaaS Dashboard is Broken' (CTR declined 42%)",
        startedAt: daysAgo(0),
      },
      {
        workspaceId: ws1.id,
        title: "Budget reallocation analysis",
        family: "review",
        agentType: "budget_optimizer",
        trigger: "scheduled",
        status: "completed",
        reason: "Weekly budget optimization cycle",
        startedAt: daysAgo(2),
        completedAt: daysAgo(2),
        output: { reallocated: true, moved: "$50/day from LinkedIn to Google Search" },
      },
      {
        workspaceId: ws1.id,
        title: "Competitor analysis — ChartMogul new features",
        family: "research",
        agentType: "competitor_analyst",
        trigger: "event",
        status: "queued",
        reason: "Competitor signal: ChartMogul announced new AI features",
      },
      {
        workspaceId: ws1.id,
        title: "SEO content — LTV calculation guide",
        family: "production",
        agentType: "seo_specialist",
        trigger: "scheduled",
        status: "generating",
        reason: "Weekly SEO content production cycle",
        startedAt: daysAgo(0),
      },
    ],
  });

  // Memories for FlowMetrics
  await prisma.memory.createMany({
    data: [
      {
        workspaceId: ws1.id,
        type: "winning_angle",
        title: "Pain-point messaging outperforms benefits",
        content:
          'Headlines that address specific pain points ("Stop guessing your metrics") consistently outperform benefit-driven headlines ("See your MRR in real-time") by 18-25% on CTR for this audience.',
        confidence: 0.88,
        evidenceCount: 7,
        tags: ["messaging", "meta", "headlines"],
      },
      {
        workspaceId: ws1.id,
        type: "audience_insight",
        title: "Series A founders convert best",
        content:
          "Series A startup founders (25-35 age range) have the highest conversion rate at 4.2%. Series B VPs of Growth have higher average deal value but lower conversion rate (2.1%).",
        confidence: 0.82,
        evidenceCount: 5,
        tags: ["audience", "conversion", "segmentation"],
      },
      {
        workspaceId: ws1.id,
        type: "channel_insight",
        title: "Google Search > Meta for high-intent",
        content:
          "Google Search consistently delivers 35% lower CPA than Meta for high-intent conversions. Meta is better for awareness and top-of-funnel volume.",
        confidence: 0.91,
        evidenceCount: 12,
        tags: ["channels", "cpa", "google", "meta"],
      },
      {
        workspaceId: ws1.id,
        type: "creative_pattern",
        title: "Creatives fatigue after 10-14 days",
        content:
          "Ad creatives for this audience show CTR decline starting around day 10-14. Schedule rotation before day 12 for optimal performance.",
        confidence: 0.76,
        evidenceCount: 4,
        tags: ["creative", "fatigue", "rotation"],
      },
      {
        workspaceId: ws1.id,
        type: "failing_angle",
        title: "Competitive messaging underperforms",
        content:
          'Direct competitive attacks ("Better than Mixpanel") generate clicks but low conversion rates. The audience responds poorly to negative competitor framing.',
        confidence: 0.85,
        evidenceCount: 3,
        tags: ["messaging", "competitive", "negative"],
      },
      {
        workspaceId: ws1.id,
        type: "experiment_result",
        title: "Short retargeting windows win",
        content:
          "7-day retargeting windows outperform 30-day windows by 23% on CPA. Users who don't convert within a week are unlikely to convert from retargeting alone.",
        confidence: 0.97,
        evidenceCount: 1,
        tags: ["retargeting", "experiment", "cpa"],
      },
    ],
  });

  // Events for FlowMetrics
  await prisma.event.createMany({
    data: [
      {
        workspaceId: ws1.id,
        type: "workspace_created",
        data: { action: "workspace_created" },
        createdAt: daysAgo(30),
      },
      {
        workspaceId: ws1.id,
        type: "workspace_status_changed",
        data: { from: "onboarding", to: "auditing", reason: "Onboarding complete" },
        createdAt: daysAgo(29),
      },
      {
        workspaceId: ws1.id,
        type: "workspace_status_changed",
        data: { from: "auditing", to: "strategy_ready", reason: "Audit complete — strategy formulated" },
        createdAt: daysAgo(27),
      },
      {
        workspaceId: ws1.id,
        type: "workspace_status_changed",
        data: { from: "launching", to: "monitoring", reason: "All campaigns live" },
        createdAt: daysAgo(20),
      },
      {
        workspaceId: ws1.id,
        type: "campaign_launched",
        data: { campaignName: "SaaS Founders — Meta Prospecting", platform: "meta" },
        createdAt: daysAgo(20),
      },
      {
        workspaceId: ws1.id,
        type: "campaign_launched",
        data: { campaignName: "Subscription Analytics — Google Search", platform: "google" },
        createdAt: daysAgo(20),
      },
      {
        workspaceId: ws1.id,
        type: "budget_reallocated",
        data: {
          from: "LinkedIn Thought Leadership",
          to: "Subscription Analytics — Google Search",
          amount: 50,
          reason: "Google Search ROAS 3.8x vs LinkedIn 1.8x — reallocating to higher performer",
        },
        createdAt: daysAgo(5),
      },
      {
        workspaceId: ws1.id,
        type: "creative_fatigue_detected",
        data: {
          creativeName: "Your SaaS Dashboard is Broken",
          ctrDecline: 0.42,
          severity: "high",
          reason: "CTR declined 42% over 5 days",
        },
        createdAt: daysAgo(1),
      },
      {
        workspaceId: ws1.id,
        type: "campaign_budget_changed",
        data: {
          campaignName: "Retargeting — Website Visitors",
          oldBudget: 100,
          newBudget: 75,
          reason: "Reducing retargeting spend while testing new window sizes",
        },
        createdAt: daysAgo(3),
      },
      {
        workspaceId: ws1.id,
        type: "agent_action_taken",
        data: {
          agentType: "performance_analyst",
          action: "Generated daily performance report",
          reason: "Scheduled daily review",
        },
        createdAt: daysAgo(0),
      },
    ],
  });

  // Link demo user to workspace 1
  await prisma.workspaceMember.create({
    data: { workspaceId: ws1.id, userId: demoUser.id, role: "owner" },
  });

  console.log(`✅ Workspace 1: "${ws1.name}" (${ws1.status}) — 5 campaigns, 3 creatives, 5 tasks, 6 memories, 10 events\n`);

  // ─── Workspace 2: Early-stage DTC brand (producing phase) ────
  const ws2 = await prisma.workspace.create({
    data: {
      name: "PureBlend Supplements",
      slug: "pureblend",
      status: "producing",
    },
  });

  await prisma.workspaceConfig.create({
    data: {
      workspaceId: ws2.id,
      productName: "PureBlend",
      productDescription:
        "Premium nootropic supplement stack for knowledge workers. Clinically-dosed, third-party tested, subscription model.",
      productUrl: "https://pureblend.co",
      industry: "DTC / Health & Wellness",
      stage: "launch",
      icpDescription:
        "Tech professionals (25-40) interested in cognitive performance, biohacking, and productivity optimization. Income $80K+.",
      brandVoice:
        "Science-backed but not boring. Think 'smart friend who reads the studies.' Clean, premium, no bro-science.",
      monthlyBudget: 8000,
      primaryGoal: "revenue",
      targetCac: 30,
      targetRoas: 2.5,
      autonomyMode: "approval",
      targetGeographies: ["US"],
    },
  });

  await prisma.connectedAccount.create({
    data: {
      workspaceId: ws2.id,
      platform: "meta",
      accountId: "act_mock_pb_meta",
      accountName: "PureBlend - Meta Ads",
      credentials: { accessToken: "mock_token_pb", refreshToken: "mock_refresh_pb" },
      scopes: ["ads_management"],
      isActive: true,
    },
  });

  // Campaigns for PureBlend (fewer, earlier stage)
  await prisma.campaign.createMany({
    data: [
      {
        workspaceId: ws2.id,
        name: "Launch — Nootropic Stack Awareness",
        type: "paid_social",
        status: "draft",
        objective: "awareness",
        targetAudience: "Tech professionals interested in cognitive enhancement",
        messagingAngle: "Unlock your brain's potential — backed by science",
        dailyBudget: 100,
        totalBudget: 3000,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        revenue: 0,
      },
      {
        workspaceId: ws2.id,
        name: "Google Search — Nootropics",
        type: "paid_search",
        status: "draft",
        objective: "conversions",
        dailyBudget: 80,
        totalBudget: 2400,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        revenue: 0,
      },
    ],
  });

  // Tasks for PureBlend
  await prisma.task.createMany({
    data: [
      {
        workspaceId: ws2.id,
        title: "Generate launch ad copy — 5 variants",
        family: "production",
        agentType: "creative_strategist",
        trigger: "request",
        status: "generating",
        reason: "Producing content for launch campaign",
        startedAt: daysAgo(0),
      },
      {
        workspaceId: ws2.id,
        title: "Research nootropics keyword landscape",
        family: "research",
        agentType: "seo_specialist",
        trigger: "request",
        status: "completed",
        reason: "Keyword research for Google Search campaign",
        startedAt: daysAgo(2),
        completedAt: daysAgo(1),
        output: { topKeywords: ["best nootropics", "nootropic stack", "cognitive supplements"], searchVolume: 45000 },
      },
      {
        workspaceId: ws2.id,
        title: "Competitor analysis — leading nootropic brands",
        family: "research",
        agentType: "competitor_analyst",
        trigger: "request",
        status: "completed",
        reason: "Understanding competitive landscape before launch",
        startedAt: daysAgo(3),
        completedAt: daysAgo(2),
      },
    ],
  });

  // Events for PureBlend
  await prisma.event.createMany({
    data: [
      {
        workspaceId: ws2.id,
        type: "workspace_created",
        data: { action: "workspace_created" },
        createdAt: daysAgo(5),
      },
      {
        workspaceId: ws2.id,
        type: "workspace_status_changed",
        data: { from: "onboarding", to: "auditing", reason: "Setup complete" },
        createdAt: daysAgo(4),
      },
      {
        workspaceId: ws2.id,
        type: "workspace_status_changed",
        data: { from: "strategy_ready", to: "producing", reason: "Strategy approved — entering content production" },
        createdAt: daysAgo(1),
      },
    ],
  });

  // Memory for PureBlend
  await prisma.memory.createMany({
    data: [
      {
        workspaceId: ws2.id,
        type: "audience_insight",
        title: "Target audience prefers science-backed claims",
        content:
          "Competitor analysis shows top-performing nootropic ads lead with clinical study references and specific dosage information rather than lifestyle imagery.",
        confidence: 0.65,
        evidenceCount: 2,
        tags: ["audience", "messaging", "research"],
      },
      {
        workspaceId: ws2.id,
        type: "channel_insight",
        title: "TikTok has high nootropic engagement",
        content:
          "Competitor brands see 3-5x more engagement on TikTok vs Instagram for nootropic content. Consider TikTok as primary social channel.",
        confidence: 0.55,
        evidenceCount: 1,
        tags: ["channels", "tiktok", "research"],
      },
    ],
  });

  // Link demo user to workspace 2
  await prisma.workspaceMember.create({
    data: { workspaceId: ws2.id, userId: demoUser.id, role: "owner" },
  });

  console.log(`✅ Workspace 2: "${ws2.name}" (${ws2.status}) — 2 campaigns, 3 tasks, 2 memories\n`);

  // ─── Workspace 3: B2B SaaS (scaling phase) ────
  const ws3 = await prisma.workspace.create({
    data: {
      name: "DevHire",
      slug: "devhire",
      status: "scaling",
    },
  });

  await prisma.workspaceConfig.create({
    data: {
      workspaceId: ws3.id,
      productName: "DevHire",
      productDescription:
        "AI-powered technical hiring platform. Automated coding assessments, candidate ranking, and ATS integration.",
      productUrl: "https://devhire.io",
      industry: "HR Tech / Recruiting",
      stage: "scale",
      icpDescription:
        "Engineering managers and CTOs at mid-market tech companies (50-500 employees) hiring 5+ engineers per quarter.",
      brandVoice: "Professional, efficient, slightly witty. We save time, not waste it.",
      monthlyBudget: 25000,
      primaryGoal: "demos",
      targetCac: 120,
      targetRoas: 5.0,
      autonomyMode: "autonomous",
      targetGeographies: ["US", "UK", "DE", "FR"],
    },
  });

  await prisma.connectedAccount.createMany({
    data: [
      {
        workspaceId: ws3.id,
        platform: "google",
        accountId: "mock_dh_google",
        accountName: "DevHire - Google Ads",
        credentials: { accessToken: "mock_token_dh_google" },
        scopes: ["adwords"],
        isActive: true,
        lastSyncAt: daysAgo(0),
      },
      {
        workspaceId: ws3.id,
        platform: "linkedin",
        accountId: "mock_dh_linkedin",
        accountName: "DevHire - LinkedIn Ads",
        credentials: { accessToken: "mock_token_dh_linkedin" },
        scopes: ["ads"],
        isActive: true,
        lastSyncAt: daysAgo(0),
      },
    ],
  });

  await Promise.all([
    prisma.campaign.create({
      data: {
        workspaceId: ws3.id,
        name: "Technical Hiring — Google Search",
        type: "paid_search",
        status: "active",
        objective: "conversions",
        dailyBudget: 350,
        totalBudget: 10500,
        platformCampaignIds: { google: "mock_camp_dh_1" },
        impressions: randInt(200000, 400000),
        clicks: randInt(8000, 15000),
        conversions: randInt(300, 600),
        spend: rand(7000, 12000),
        revenue: rand(45000, 80000),
        ctr: rand(0.03, 0.05),
        cpc: rand(0.8, 1.5),
        cpa: rand(18, 35),
        roas: rand(5.0, 8.0),
      },
    }),
    prisma.campaign.create({
      data: {
        workspaceId: ws3.id,
        name: "CTOs & Eng Managers — LinkedIn",
        type: "paid_social",
        status: "active",
        objective: "conversions",
        dailyBudget: 250,
        totalBudget: 7500,
        impressions: randInt(50000, 100000),
        clicks: randInt(1500, 3000),
        conversions: randInt(60, 120),
        spend: rand(4000, 7000),
        revenue: rand(15000, 35000),
        ctr: rand(0.02, 0.04),
        cpc: rand(2.5, 5.0),
        cpa: rand(50, 90),
        roas: rand(3.5, 6.0),
      },
    }),
    prisma.campaign.create({
      data: {
        workspaceId: ws3.id,
        name: "Brand — Developer Content",
        type: "seo_content",
        status: "active",
        objective: "awareness",
        impressions: randInt(100000, 250000),
        clicks: randInt(8000, 20000),
        conversions: randInt(150, 300),
        spend: 0,
        revenue: rand(8000, 15000),
      },
    }),
  ]);

  // Tasks for DevHire
  await prisma.task.createMany({
    data: [
      {
        workspaceId: ws3.id,
        title: "Scale Google Search campaign to EU markets",
        family: "execution",
        agentType: "ads_manager",
        trigger: "scheduled",
        status: "approved",
        reason: "Strong US performance (ROAS 6.2x) — expanding to DE/FR",
        startedAt: daysAgo(0),
      },
      {
        workspaceId: ws3.id,
        title: "Weekly strategy review",
        family: "review",
        agentType: "growth_strategist",
        trigger: "scheduled",
        status: "completed",
        reason: "Scheduled weekly strategy review",
        completedAt: daysAgo(1),
        output: { recommendation: "Increase Google Search budget by 20%, test new LinkedIn audience segments" },
      },
    ],
  });

  // Memory for DevHire
  await prisma.memory.createMany({
    data: [
      {
        workspaceId: ws3.id,
        type: "winning_angle",
        title: "Time-saving messaging converts best",
        content:
          '"Save 40 hours per hire" and similar time-saving angles outperform cost-saving angles by 32% on conversion rate for engineering managers.',
        confidence: 0.93,
        evidenceCount: 15,
        tags: ["messaging", "conversion", "b2b"],
      },
      {
        workspaceId: ws3.id,
        type: "channel_insight",
        title: "LinkedIn CPA acceptable for deal size",
        content:
          "LinkedIn CPA ($70-90) is 3x higher than Google Search but deal sizes are 2x larger. Net ROI is comparable. Keep both channels active.",
        confidence: 0.87,
        evidenceCount: 8,
        tags: ["channels", "linkedin", "google", "roi"],
      },
      {
        workspaceId: ws3.id,
        type: "funnel_insight",
        title: "Demo-to-close rate is 28%",
        content:
          "28% of demo bookings convert to paid customers. Average deal size is $2,400/year. This means target CPA for demos should be under $120 for positive ROI.",
        confidence: 0.95,
        evidenceCount: 20,
        tags: ["funnel", "conversion", "unit-economics"],
      },
    ],
  });

  // Events for DevHire
  await prisma.event.createMany({
    data: [
      {
        workspaceId: ws3.id,
        type: "workspace_status_changed",
        data: { from: "optimizing", to: "scaling", reason: "ROAS consistently above 5x target — entering scale phase" },
        createdAt: daysAgo(7),
      },
      {
        workspaceId: ws3.id,
        type: "budget_reallocated",
        data: {
          from: "LinkedIn Cold Audience (paused)",
          to: "Technical Hiring — Google Search",
          amount: 100,
          reason: "Google Search ROAS 6.2x — doubling down on highest performer",
        },
        createdAt: daysAgo(4),
      },
      {
        workspaceId: ws3.id,
        type: "agent_action_taken",
        data: {
          agentType: "growth_strategist",
          action: "Recommended EU expansion based on strong US metrics",
          reason: "Autonomous decision — ROAS exceeds 5x threshold for expansion",
        },
        createdAt: daysAgo(2),
      },
    ],
  });

  // Link demo user to workspace 3
  await prisma.workspaceMember.create({
    data: { workspaceId: ws3.id, userId: demoUser.id, role: "owner" },
  });

  console.log(`✅ Workspace 3: "${ws3.name}" (${ws3.status}) — 3 campaigns, 2 tasks, 3 memories\n`);

  console.log("🎉 Seed complete! 3 workspaces with realistic mock data.\n");
  console.log("   FlowMetrics  — monitoring phase (active ads, fatigue detected)");
  console.log("   PureBlend    — producing phase (pre-launch, content creation)");
  console.log("   DevHire      — scaling phase (high ROAS, expanding markets)");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
