"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Zap,
  Shield,
  Globe,
  DollarSign,
  Search,
  Megaphone,
  BarChart3,
  Mail,
  Bot,
  Plug,
  Key,
  Monitor,
  Wand2,
  FileText,
} from "lucide-react";
import { SetupWizard } from "@/components/dashboard/setup-wizard";

// ============================================================
// Guide Data
// ============================================================

interface GuideStep {
  title: string;
  content: string;
  code?: string;
  codes?: { label: string; value: string }[];
  link?: { label: string; url: string };
  warning?: string;
  tip?: string;
}

interface Guide {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  timeEstimate: string;
  steps: GuideStep[];
  envVars?: { key: string; description: string }[];
}

const guides: Guide[] = [
  // ---------- AD PLATFORMS ----------
  {
    id: "google-ads",
    title: "Google Ads",
    description:
      "Connect Google Ads to create Search, Display, and Performance Max campaigns directly from the dashboard.",
    icon: Search,
    category: "Ad Platforms",
    difficulty: "intermediate",
    timeEstimate: "15-20 min",
    steps: [
      {
        title: "Create a Google Cloud Project",
        content:
          "Go to the Google Cloud Console and create a new project (or use an existing one). This project will hold your OAuth credentials.",
        link: {
          label: "Google Cloud Console",
          url: "https://console.cloud.google.com/projectcreate",
        },
      },
      {
        title: "Enable the Google Ads API",
        content:
          'In your GCP project, go to APIs & Services > Library. Search for "Google Ads API" and click Enable.',
        link: {
          label: "API Library",
          url: "https://console.cloud.google.com/apis/library/googleads.googleapis.com",
        },
      },
      {
        title: "Create OAuth 2.0 Credentials",
        content:
          'Go to APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client ID. Select "Web application" as the type.',
        link: {
          label: "Create Credentials",
          url: "https://console.cloud.google.com/apis/credentials",
        },
      },
      {
        title: "Configure OAuth Consent Screen",
        content:
          'Set up the OAuth consent screen with your app name and authorized domains. For testing, select "External" user type and add your email as a test user.',
        tip: 'You can stay in "Testing" mode — no verification needed for test accounts.',
      },
      {
        title: "Set Authorized Redirect URI",
        content:
          "Add the callback URL to your OAuth client. For local development:",
        code: "{ORIGIN}/api/oauth/google/callback",
        tip: "The URL shown is your current environment. In production, it will use your actual domain automatically.",
      },
      {
        title: "Get a Google Ads Developer Token",
        content:
          "Sign into Google Ads (ads.google.com), go to Tools & Settings > API Center. Apply for a developer token. For testing, you can use the test account token immediately.",
        link: {
          label: "Google Ads API Center",
          url: "https://ads.google.com/aw/apicenter",
        },
        warning:
          "The developer token starts with basic access (test accounts only). Apply for Standard access for production use.",
      },
      {
        title: "Create a Google Ads Test Account (Sandbox)",
        content:
          'To test without spending real money, create a Google Ads Manager Account (MCC), then create a test account under it. Go to Google Ads > Tools > Account Manager > Create test account. Test accounts simulate everything with a "$5,000" fake balance.',
        link: {
          label: "Google Ads Manager",
          url: "https://ads.google.com/aw/accountmanager",
        },
        tip: "Test accounts cannot serve real ads. Perfect for development and QA.",
      },
      {
        title: "Add Environment Variables",
        content: "Add these to your .env file:",
        code: 'GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"\nGOOGLE_CLIENT_SECRET="your-client-secret"\nGOOGLE_ADS_DEVELOPER_TOKEN="your-developer-token"',
      },
      {
        title: "Connect from Dashboard",
        content:
          'Go to Settings > Connected Platforms, or start the onboarding wizard. Click "Connect Google" — you\'ll be redirected to Google\'s OAuth flow. After authorization, your account will appear as connected.',
      },
      {
        title: "Launch a Campaign",
        content:
          'Navigate to any campaign, click "Approve & Launch". The system will push the campaign structure (campaign → ad groups → ads) to your Google Ads account. Campaigns are created in PAUSED state for safety — enable them manually in Google Ads when ready.',
        tip: "With a test account, campaigns are simulated. Switch to a real account for live ads.",
      },
    ],
    envVars: [
      {
        key: "GOOGLE_CLIENT_ID",
        description: "OAuth 2.0 Client ID from GCP Console",
      },
      {
        key: "GOOGLE_CLIENT_SECRET",
        description: "OAuth 2.0 Client Secret from GCP Console",
      },
      {
        key: "GOOGLE_ADS_DEVELOPER_TOKEN",
        description: "Developer token from Google Ads API Center",
      },
    ],
  },
  {
    id: "meta-ads",
    title: "Meta Ads (Facebook & Instagram)",
    description:
      "Connect Meta Business to run paid social campaigns on Facebook and Instagram.",
    icon: Megaphone,
    category: "Ad Platforms",
    difficulty: "beginner",
    timeEstimate: "10 min",
    steps: [
      {
        title: "Open Meta Business Settings",
        content:
          "Go to Meta Business Suite and open Business Settings. You need admin access to the Business Account that owns your ad accounts.\n\nAll configuration (ad accounts, system users, access tokens) happens here.",
        link: {
          label: "Meta Business Settings",
          url: "https://business.facebook.com/settings/",
        },
      },
      {
        title: "Link or Create an Ad Account",
        content:
          "In Business Settings:\n\n1. Left sidebar > Accounts > Ad Accounts\n2. Add an existing ad account or create a new one\n3. Set your currency and timezone\n4. Note the Ad Account ID (starts with \"act_\")",
        link: {
          label: "Business Settings — Ad Accounts",
          url: "https://business.facebook.com/settings/ad-accounts",
        },
      },
      {
        title: "Create a System User",
        content:
          "A System User is a service account that lets Kalit manage ads on your behalf. No OAuth or login redirect needed — just a long-lived token.\n\n1. Left sidebar > Users > System Users\n2. Click \"Add\" to create a new system user\n3. Name it \"Kalit Marketing\"\n4. Set role to \"Admin\"\n5. Click \"Create System User\"",
        link: {
          label: "Business Settings — System Users",
          url: "https://business.facebook.com/settings/system-users",
        },
        warning: "You must be an admin of the Business Account to create system users.",
      },
      {
        title: "Assign Ad Account to System User",
        content:
          "Give the system user access to your ad account:\n\n1. Click on the system user you just created\n2. Click \"Assign Assets\"\n3. Select \"Ad Accounts\" on the left\n4. Find and select your ad account\n5. Toggle ON \"Full control\" (needed to create/edit campaigns)\n6. Click \"Save Changes\"",
      },
      {
        title: "Generate Access Token",
        content:
          "Generate a long-lived token for the system user:\n\n1. On the System Users page, click your system user\n2. Click \"Generate New Token\"\n3. Select your app (if prompted)\n4. Select permissions: ads_management, ads_read, business_management\n5. Click \"Generate Token\"\n6. Copy the token immediately — it won't be shown again",
        warning: "Save the token somewhere secure. It never expires and grants full access to your ad accounts.",
      },
      {
        title: "Add Your Credentials to Kalit",
        content:
          "Paste the System User access token and Ad Account ID below:",
        code: 'META_ACCESS_TOKEN="EAAxxxxxxx..."\nMETA_AD_ACCOUNT_ID="act_123456789"',
        tip: "The System User token never expires. No OAuth, no HTTPS redirect, no ngrok needed. Kalit connects directly using this token.",
      },
      {
        title: "Verify the Connection",
        content:
          "Check that Meta appears with a green status. If it fails:\n\n1. Token invalid — regenerate from Business Settings > System Users\n2. No access — assign the ad account to the system user with Full Control\n3. Wrong Ad Account ID — must start with \"act_\"",
      },
    ],
    envVars: [
      { key: "META_ACCESS_TOKEN", description: "System User access token from Business Settings" },
      { key: "META_AD_ACCOUNT_ID", description: "Ad Account ID (starts with act_)" },
    ],
  },
  {
    id: "tiktok-ads",
    title: "TikTok Ads",
    description:
      "Connect TikTok Business Center to run video ads and spark ads.",
    icon: Monitor,
    category: "Ad Platforms",
    difficulty: "intermediate",
    timeEstimate: "15-20 min",
    steps: [
      {
        title: "Go to TikTok Business Center",
        content:
          "Open business.tiktok.com and sign in with your TikTok account. If you don't have a TikTok Business Center account, click \"Create an account\" and follow the setup — you'll need a business name, industry, and timezone.",
        link: {
          label: "TikTok Business Center",
          url: "https://business.tiktok.com/",
        },
      },
      {
        title: "Create an Ad Account",
        content:
          "In TikTok Business Center, go to Assets > Ad Accounts and create one if you don't have one. Set your currency and timezone. You'll need an active ad account to run campaigns through the API.",
        tip: "For testing, TikTok provides a sandbox environment. You can request sandbox access when creating your developer app.",
      },
      {
        title: "Register a Developer App",
        content:
          "Go to the TikTok Marketing API portal. Click \"My Apps\" > \"Create App\". Fill in:\n\n• App name (e.g. \"Kalit Marketing\")\n• Description of what your app does\n• Select the Marketing API product\n• Choose the scopes: Ad Account Management, Ads Management, Audience Management, Reporting, Measurement, Creative Management\n\nSubmit for review — sandbox access is usually granted quickly.",
        link: {
          label: "TikTok Marketing API Portal",
          url: "https://business-api.tiktok.com/portal/apps",
        },
        warning: "TikTok requires app review before you can access production APIs. Sandbox mode is available immediately for testing.",
      },
      {
        title: "Configure OAuth Redirect URI",
        content: "In your app settings, add the OAuth redirect URI. For local development:",
        code: "{ORIGIN}/api/oauth/tiktok/callback",
        tip: "The URL shown matches your current environment. Add your production domain too if needed.",
      },
      {
        title: "Get Your App Credentials",
        content:
          "In the app dashboard, find your App ID and App Secret. Copy both values.",
      },
      {
        title: "Add Credentials to Kalit",
        content: "Go to Settings in the dashboard and paste your credentials, or add them to your .env file:",
        code: 'TIKTOK_CLIENT_ID="your-app-id"\nTIKTOK_CLIENT_SECRET="your-app-secret"',
      },
      {
        title: "Connect and Verify",
        content:
          "Click \"Connect TikTok\" in Settings or the onboarding wizard. You'll be redirected to TikTok's authorization page. Grant access to your ad account, and you'll be redirected back with a success message.",
        tip: "If authorization fails, ensure your app has been approved and the redirect URI matches exactly.",
      },
    ],
    envVars: [
      { key: "TIKTOK_CLIENT_ID", description: "TikTok App ID from Marketing API portal" },
      { key: "TIKTOK_CLIENT_SECRET", description: "TikTok App Secret from Marketing API portal" },
    ],
  },
  {
    id: "x-ads",
    title: "X (Twitter) Ads",
    description:
      "Connect X to run promoted tweets and handle organic social posting.",
    icon: Globe,
    category: "Ad Platforms",
    difficulty: "intermediate",
    timeEstimate: "15-20 min",
    steps: [
      {
        title: "Go to the X Developer Console",
        content:
          "Open console.x.com and sign in with the X account you want to use for advertising. If you don't have a developer account yet, you'll be prompted to sign up and describe your use case.",
        link: {
          label: "X Developer Console",
          url: "https://console.x.com/",
        },
        tip: "X uses a pay-per-use credit model. You can buy credits or enable auto-recharge from the Billing section in the console.",
      },
      {
        title: "Create an App",
        content:
          "In the console, click \"Apps\" in the left sidebar, then \"Create App\". Enter a name (e.g. \"Kalit Marketing\") and save.\n\nYou'll land on the app detail page showing:\n• A Bearer Token (for app-only auth)\n• OAuth 1.0 Keys (Consumer Key, Access Token)\n\nIgnore those — we need OAuth 2.0, which requires an extra setup step.",
      },
      {
        title: "Set Up User Authentication (OAuth 2.0)",
        content:
          "On your app's detail page, scroll to \"User authentication settings\" and click \"Set up\". You'll go through 3 screens:\n\n1. App permissions → select \"Read and write\"\n2. Type of App → select \"Web App, Automated App or Bot\" (confidential client — gives you a Client Secret)\n3. App info — two required fields (copy each below). The rest (Organization, Terms of Service, Privacy Policy) are optional.\n\nClick Save. This enables OAuth 2.0 and generates your Client ID and Client Secret.",
        codes: [
          { label: "Callback URI / Redirect URL (required)", value: "{ORIGIN}/api/oauth/x/callback" },
          { label: "Website URL (required)", value: "https://kalit.ai" },
        ],
        tip: "The Website URL is informational only — it doesn't affect the OAuth flow. Only the Callback URI must match exactly.",
      },
      {
        title: "Copy Your OAuth 2.0 Client ID and Secret",
        content:
          "After saving User authentication settings, your OAuth 2.0 credentials are generated. Copy the Client ID and Client Secret immediately — the Client Secret is only shown once.\n\nX shows two separate credential sets on your app page:\n• Consumer Key & Access Token → OAuth 1.0a (at the top, ignore these)\n• Client ID & Client Secret → OAuth 2.0 (what we need, generated after \"Set up\")\n\nMake sure you're copying from the OAuth 2.0 section.",
        warning: "The OAuth 2.0 Client ID/Secret are NOT the same as the Consumer Key/Access Token shown at the top. Those are OAuth 1.0a credentials.",
      },
      {
        title: "Request Ads API Access",
        content:
          "To run paid campaigns (promoted tweets, ad management, audience targeting), you need Ads API access:\n\n1. Go to ads.x.com and set up your advertising account with billing info\n2. Then go to ads.x.com/help and submit an Ads API access application\n3. Choose \"Standard Access\" for full campaign management (analytics, creatives, audiences)\n4. After approval, regenerate your user access tokens in the Developer Console\n\nApproval may take a few days. You can proceed to connect your account now — the OAuth connection works independently from Ads API access.",
        link: {
          label: "X Ads",
          url: "https://ads.x.com/",
        },
        tip: "\"Standard Access\" is what you need for full campaign management. \"Conversion Only\" is limited to tracking only.",
      },
      {
        title: "Add Credentials to Kalit",
        content: "Go to Settings in the dashboard and paste your OAuth 2.0 credentials, or add them to your .env file:",
        code: 'X_CLIENT_ID="your-oauth2-client-id"\nX_CLIENT_SECRET="your-oauth2-client-secret"',
      },
      {
        title: "Connect and Verify",
        content:
          "Click \"Connect X\" in Settings or the onboarding wizard. You'll be redirected to X to authorize the app. After approval, you'll be redirected back with a success message and your @handle will appear in connected platforms.",
        tip: "If connection fails: 1) Callback URL must match exactly (no trailing slash mismatch), 2) Use OAuth 2.0 Client ID/Secret (not API Key/Secret), 3) Ensure OAuth 2.0 is configured in your app settings.",
      },
    ],
    envVars: [
      { key: "X_CLIENT_ID", description: "OAuth 2.0 Client ID from console.x.com > Apps > Keys and Tokens" },
      { key: "X_CLIENT_SECRET", description: "OAuth 2.0 Client Secret from console.x.com > Apps > Keys and Tokens" },
    ],
  },
  {
    id: "linkedin-ads",
    title: "LinkedIn Ads",
    description:
      "Connect LinkedIn to run sponsored content and B2B lead gen campaigns.",
    icon: Globe,
    category: "Ad Platforms",
    difficulty: "intermediate",
    timeEstimate: "15-20 min",
    steps: [
      {
        title: "Go to LinkedIn Developer Portal",
        content:
          "Open linkedin.com/developers and sign in with the LinkedIn account that manages your company page. Click \"Create App\" to get started.",
        link: {
          label: "LinkedIn Developers",
          url: "https://www.linkedin.com/developers/apps/new",
        },
      },
      {
        title: "Create a LinkedIn App",
        content:
          "Fill in the app details:\n\n• App name (e.g. \"Kalit Marketing\")\n• LinkedIn Page — select your company page (required)\n• Privacy policy URL — your website's privacy policy\n• App logo\n\nAfter creation, you'll get your Client ID and Client Secret.",
        tip: "You must be an admin of the LinkedIn Company Page to associate it with the app.",
      },
      {
        title: "Request Marketing Developer Platform Access",
        content:
          "In your app's dashboard, go to the \"Products\" tab. Find \"Marketing Developer Platform\" and click \"Request access\". This grants the scopes needed for ads management (r_ads, rw_ads). Approval can take a few days.",
        warning: "Without Marketing Developer Platform access, you can only do organic posting. Ads management requires this product approval.",
      },
      {
        title: "Configure OAuth 2.0 Redirect URL",
        content:
          "Go to the \"Auth\" tab in your app settings. Under \"Authorized redirect URLs for your app\", add your callback URL. The URL format is:",
        code: "{ORIGIN}/api/oauth/linkedin/callback",
      },
      {
        title: "Copy Client ID and Client Secret",
        content:
          "In the \"Auth\" tab, copy your Client ID and Client Secret (click the eye icon to reveal the secret).",
      },
      {
        title: "Set Up a LinkedIn Ad Account",
        content:
          "Go to linkedin.com/campaignmanager to create or access your LinkedIn Campaign Manager account. You'll need an active ad account with billing set up to run paid campaigns.",
        link: {
          label: "LinkedIn Campaign Manager",
          url: "https://www.linkedin.com/campaignmanager/",
        },
      },
      {
        title: "Add Credentials to Kalit",
        content: "Go to Settings in the dashboard and paste your credentials, or add them to your .env file:",
        code: 'LINKEDIN_CLIENT_ID="your-client-id"\nLINKEDIN_CLIENT_SECRET="your-client-secret"',
      },
      {
        title: "Connect and Verify",
        content:
          "Click \"Connect LinkedIn\" in Settings. Authorize the app on LinkedIn's consent screen, and you'll be redirected back with a success message.",
        tip: "If connection fails, ensure: 1) Redirect URL matches exactly, 2) Marketing Developer Platform is approved, 3) You're an admin of the associated Company Page.",
      },
    ],
    envVars: [
      { key: "LINKEDIN_CLIENT_ID", description: "LinkedIn App Client ID from Auth tab" },
      {
        key: "LINKEDIN_CLIENT_SECRET",
        description: "LinkedIn App Client Secret from Auth tab",
      },
    ],
  },
  {
    id: "reddit-ads",
    title: "Reddit Ads",
    description:
      "Connect Reddit to run promoted posts targeting specific subreddit communities and interest groups.",
    icon: Globe,
    category: "Ad Platforms",
    difficulty: "intermediate",
    timeEstimate: "10-15 min",
    steps: [
      {
        title: "Go to Reddit Apps",
        content:
          "Open reddit.com/prefs/apps while logged in with the Reddit account you want to use for advertising. Scroll down to \"developed applications\".",
        link: {
          label: "Reddit Apps",
          url: "https://www.reddit.com/prefs/apps",
        },
      },
      {
        title: "Create a Reddit App",
        content:
          "Click \"create another app...\" at the bottom. Fill in:\n\n• Name: e.g. \"Kalit Marketing\"\n• Type: select \"web app\"\n• Description: brief description of your use\n• Redirect URI: your callback URL (shown below)\n\nClick \"create app\".",
        code: "{ORIGIN}/api/oauth/reddit/callback",
      },
      {
        title: "Copy Your Credentials",
        content:
          "After creation, you'll see:\n\n• Client ID — the string under the app name (looks like a random string)\n• Client Secret — labeled \"secret\"\n\nCopy both values.",
      },
      {
        title: "Set Up a Reddit Ads Account",
        content:
          "Go to ads.reddit.com to create or access your Reddit Ads account. Set up billing and create an ad account. You'll need this to run paid promoted posts.",
        link: {
          label: "Reddit Ads",
          url: "https://ads.reddit.com/",
        },
      },
      {
        title: "Add Credentials to Kalit",
        content: "Go to Settings in the dashboard and paste your credentials, or add them to your .env file:",
        code: 'REDDIT_CLIENT_ID="your-client-id"\nREDDIT_CLIENT_SECRET="your-client-secret"',
      },
      {
        title: "Connect and Verify",
        content:
          "Click \"Connect Reddit\" in Settings. Authorize the app on Reddit's consent screen, and you'll be redirected back. Reddit connections use permanent tokens with automatic refresh.",
      },
    ],
    envVars: [
      { key: "REDDIT_CLIENT_ID", description: "Reddit App Client ID" },
      { key: "REDDIT_CLIENT_SECRET", description: "Reddit App Secret" },
    ],
  },

  // ---------- AI SERVICES ----------
  {
    id: "anthropic-ai",
    title: "Anthropic Claude (AI Engine)",
    description:
      "Connect Claude to power campaign generation, creative writing, market research, and autonomous optimization.",
    icon: Bot,
    category: "AI Services",
    difficulty: "beginner",
    timeEstimate: "2 min",
    steps: [
      {
        title: "Option A: Use Anthropic API Key (Production)",
        content:
          "Get an API key from the Anthropic Console. This is the fastest and most reliable option for production.",
        link: {
          label: "Anthropic Console",
          url: "https://console.anthropic.com/settings/keys",
        },
      },
      {
        title: "Add API Key to Environment",
        content: "",
        code: 'ANTHROPIC_API_KEY="sk-ant-api03-..."',
        tip: "The system uses Claude Sonnet for most tasks (fast + capable) and Opus for complex strategy work.",
      },
      {
        title: "Option B: Use Local Claude Code Session (Development)",
        content:
          "If you have Claude Code installed and authenticated, the system automatically uses your local session when no API key is set. No configuration needed — just remove or leave ANTHROPIC_API_KEY empty.",
        tip: "This uses @anthropic-ai/claude-agent-sdk under the hood. Great for development, no billing needed.",
      },
    ],
    envVars: [
      {
        key: "ANTHROPIC_API_KEY",
        description:
          "Anthropic API key (optional — falls back to local Claude session)",
      },
    ],
  },
  {
    id: "nano-banana",
    title: "Nano Banana (AI Image Generation)",
    description:
      "Connect Nano Banana or other image generation services for creative asset production.",
    icon: Zap,
    category: "AI Services",
    difficulty: "beginner",
    timeEstimate: "5 min",
    steps: [
      {
        title: "Choose an Image Provider",
        content:
          'The system supports multiple image generation backends. Set IMAGE_GEN_PROVIDER to "flux" (Replicate/Fal) or "dall-e" (OpenAI).',
      },
      {
        title: "For Flux / Nano Banana / Fal.ai",
        content:
          "Sign up at Fal.ai or Replicate and get an API key. Flux models generate high-quality marketing visuals.",
        link: { label: "Fal.ai", url: "https://fal.ai/dashboard/keys" },
        code: 'IMAGE_GEN_PROVIDER="flux"\nFAL_KEY="your-fal-api-key"',
      },
      {
        title: "For DALL-E (OpenAI)",
        content: "Use your OpenAI API key for DALL-E 3 image generation.",
        code: 'IMAGE_GEN_PROVIDER="dall-e"\nOPENAI_API_KEY="sk-..."',
      },
    ],
    envVars: [
      {
        key: "IMAGE_GEN_PROVIDER",
        description: '"flux" or "dall-e"',
      },
      { key: "FAL_KEY", description: "Fal.ai API key (for Flux)" },
      { key: "OPENAI_API_KEY", description: "OpenAI API key (for DALL-E)" },
    ],
  },

  // ---------- ANALYTICS ----------
  {
    id: "ga4",
    title: "Google Analytics 4",
    description:
      "Connect GA4 to pull traffic, conversion, and funnel data into the reporting dashboard.",
    icon: BarChart3,
    category: "Analytics & Tracking",
    difficulty: "beginner",
    timeEstimate: "5 min",
    steps: [
      {
        title: "Get GA4 Measurement ID",
        content:
          'In your GA4 property, go to Admin > Data Streams > Web. Copy the Measurement ID (starts with "G-").',
        link: {
          label: "Google Analytics",
          url: "https://analytics.google.com/analytics/web/",
        },
      },
      {
        title: "Create a Service Account (for API access)",
        content:
          'In GCP Console, create a service account. Grant it "Viewer" role on your GA4 property. Download the JSON key file.',
        tip: "Alternatively, use the same OAuth credentials from your Google Ads setup.",
      },
      {
        title: "Connect from Dashboard",
        content:
          "In Settings, paste your GA4 API key or connect via Google OAuth (shares the same Google connection).",
      },
    ],
    envVars: [],
  },
  {
    id: "posthog",
    title: "PostHog",
    description:
      "Connect PostHog for product analytics, feature flags, and experiment tracking.",
    icon: BarChart3,
    category: "Analytics & Tracking",
    difficulty: "beginner",
    timeEstimate: "3 min",
    steps: [
      {
        title: "Get Your PostHog API Key",
        content:
          "In PostHog, go to Project Settings > API Keys. Copy your Personal API key.",
        link: { label: "PostHog", url: "https://app.posthog.com/" },
      },
      {
        title: "Connect from Dashboard",
        content:
          'In the onboarding Connect step or Settings, select "PostHog" and paste your API key.',
      },
    ],
    envVars: [],
  },

  // ---------- EMAIL ----------
  {
    id: "resend",
    title: "Resend (Email)",
    description:
      "Connect Resend to send transactional and marketing emails from your campaigns.",
    icon: Mail,
    category: "Email & CRM",
    difficulty: "beginner",
    timeEstimate: "3 min",
    steps: [
      {
        title: "Sign Up for Resend",
        content: "Create an account at resend.com and verify your domain.",
        link: { label: "Resend", url: "https://resend.com/signup" },
      },
      {
        title: "Create an API Key",
        content: "Go to API Keys in the Resend dashboard and create a new key.",
        code: 'RESEND_API_KEY="re_..."',
      },
      {
        title: "Connect from Dashboard",
        content:
          'Select "Resend" during onboarding or in Settings and paste your API key.',
      },
    ],
    envVars: [{ key: "RESEND_API_KEY", description: "Resend API key" }],
  },

  // ---------- REVENUE ----------
  {
    id: "stripe",
    title: "Stripe (Revenue Tracking)",
    description:
      "Connect Stripe to pull revenue data, track ROAS, and monitor subscription metrics.",
    icon: DollarSign,
    category: "Revenue",
    difficulty: "beginner",
    timeEstimate: "3 min",
    steps: [
      {
        title: "Get Your Stripe Secret Key",
        content:
          "In the Stripe Dashboard, go to Developers > API Keys. Copy the Secret key (sk_test_ for testing, sk_live_ for production).",
        link: {
          label: "Stripe Dashboard",
          url: "https://dashboard.stripe.com/apikeys",
        },
        tip: "Use sk_test_ keys for development — they don't process real charges.",
      },
      {
        title: "Connect from Dashboard",
        content:
          'Select "Stripe" during onboarding or in Settings and paste your API key.',
      },
    ],
    envVars: [
      { key: "STRIPE_SECRET_KEY", description: "Stripe Secret Key" },
    ],
  },

  // ---------- INFRASTRUCTURE ----------
  {
    id: "encryption",
    title: "Credential Encryption",
    description:
      "Set up the encryption key used to securely store all platform tokens and API keys in the database.",
    icon: Shield,
    category: "Infrastructure",
    difficulty: "beginner",
    timeEstimate: "1 min",
    steps: [
      {
        title: "Generate an Encryption Key",
        content:
          "Run this command to generate a random 32-byte (64 hex char) encryption key:",
        code: 'openssl rand -hex 32',
      },
      {
        title: "Add to Environment",
        content: "Add the key to your .env file:",
        code: 'ENCRYPTION_KEY="your-64-character-hex-key"',
        warning:
          "If you lose this key, all stored credentials become unreadable. Back it up securely.",
      },
    ],
    envVars: [
      {
        key: "ENCRYPTION_KEY",
        description: "64-char hex key for AES-256-GCM credential encryption",
      },
    ],
  },
  {
    id: "mock-mode",
    title: "Mock Mode (Development)",
    description:
      "Enable mock adapters to test the full pipeline without real platform credentials.",
    icon: Plug,
    category: "Infrastructure",
    difficulty: "beginner",
    timeEstimate: "1 min",
    steps: [
      {
        title: "Enable Mock Mode",
        content:
          "Set MOCK_ADAPTERS=true to use mock implementations for all platforms. Campaigns will appear to launch successfully with fake platform IDs.",
        code: 'MOCK_ADAPTERS=true',
        tip: "Great for testing the full flow (generate → approve → launch) without real accounts.",
      },
      {
        title: "Disable for Real Platforms",
        content:
          "When you're ready to use real platform accounts, set:",
        code: 'MOCK_ADAPTERS=false',
        warning: "Make sure all required credentials are configured before disabling mock mode.",
      },
    ],
    envVars: [
      {
        key: "MOCK_ADAPTERS",
        description: '"true" to use mocks, "false" for real API calls',
      },
    ],
  },
];

// ============================================================
// Components
// ============================================================

const categories = [
  "All",
  "Ad Platforms",
  "AI Services",
  "Analytics & Tracking",
  "Email & CRM",
  "Revenue",
  "Infrastructure",
];

const difficultyColors: Record<string, string> = {
  beginner: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  intermediate: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  advanced: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="absolute top-2 right-2 p-1 text-text-secondary hover:text-text transition-colors cursor-pointer"
      title="Copy"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

/** Replace {ORIGIN} and {IS_LOCALHOST?trueText|falseText} placeholders */
function resolveOrigin(text: string): string {
  if (typeof window === "undefined") return text;
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  let resolved = text;
  // Parse {IS_LOCALHOST?trueContent|falseContent} with nested {} support
  while (resolved.includes("{IS_LOCALHOST?")) {
    const start = resolved.indexOf("{IS_LOCALHOST?");
    const pipeIdx = resolved.indexOf("|", start + 14);
    let depth = 0;
    let endIdx = -1;
    for (let i = pipeIdx + 1; i < resolved.length; i++) {
      if (resolved[i] === "{") depth++;
      else if (resolved[i] === "}") {
        if (depth === 0) { endIdx = i; break; }
        depth--;
      }
    }
    if (pipeIdx === -1 || endIdx === -1) break;
    const ifTrue = resolved.slice(start + 14, pipeIdx);
    const ifFalse = resolved.slice(pipeIdx + 1, endIdx);
    resolved = resolved.slice(0, start) + (isLocalhost ? ifTrue : ifFalse) + resolved.slice(endIdx + 1);
  }
  resolved = resolved.replace(/\{ORIGIN\}/g, window.location.origin);
  return resolved;
}

function GuideCard({ guide }: { guide: Guide }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = guide.icon;

  return (
    <div className="border border-divider bg-transparent hover:border-divider transition-colors">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-start gap-4 text-left cursor-pointer"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-divider bg-transparent">
          <Icon className="h-5 w-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-text">{guide.title}</h3>
            <span
              className={`badge text-[9px] ${difficultyColors[guide.difficulty]}`}
            >
              {guide.difficulty}
            </span>
            <span className="text-[10px] text-text-secondary">
              ~{guide.timeEstimate}
            </span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            {guide.description}
          </p>
        </div>
        <div className="shrink-0 mt-1">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-text-secondary" />
          ) : (
            <ChevronRight className="h-4 w-4 text-text-secondary" />
          )}
        </div>
      </button>

      {/* Steps */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-divider pt-4 space-y-5">
          {guide.steps.map((step, i) => (
            <div key={i} className="relative pl-8">
              {/* Step number */}
              <div className="absolute left-0 top-0 flex h-5 w-5 items-center justify-center border border-accent/30 bg-accent/10 text-accent text-[10px] font-bold">
                {i + 1}
              </div>
              {/* Connector line */}
              {i < guide.steps.length - 1 && (
                <div className="absolute left-[9px] top-6 bottom-[-16px] w-px bg-subtle" />
              )}

              <h4 className="text-xs font-semibold text-text mb-1.5">
                {step.title}
              </h4>
              {step.content && (
                <p className="text-xs text-text-secondary leading-relaxed mb-2 whitespace-pre-line">
                  {resolveOrigin(step.content)}
                </p>
              )}

              {step.code && (
                <div className="relative bg-black/30 border border-divider p-3 font-mono text-[11px] text-text leading-relaxed whitespace-pre-wrap mb-2">
                  <CopyButton text={resolveOrigin(step.code)} />
                  {resolveOrigin(step.code)}
                </div>
              )}

              {step.codes && (
                <div className="space-y-2 mb-2">
                  {step.codes.map((c, j) => (
                    <div key={j}>
                      <p className="text-[10px] text-text-secondary font-medium mb-1">{c.label}</p>
                      <div className="relative bg-black/30 border border-divider p-3 font-mono text-[11px] text-text leading-relaxed whitespace-pre-wrap">
                        <CopyButton text={resolveOrigin(c.value)} />
                        {resolveOrigin(c.value)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {step.link && (
                <a
                  href={step.link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 transition-colors mb-2"
                >
                  <ExternalLink className="h-3 w-3" />
                  {step.link.label}
                </a>
              )}

              {step.warning && (
                <div className="flex items-start gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[11px] mt-2">
                  <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                  <p>{resolveOrigin(step.warning)}</p>
                </div>
              )}

              {step.tip && (
                <div className="flex items-start gap-2 p-2 bg-accent/5 border border-accent/20 text-accent/80 text-[11px] mt-2">
                  <Zap className="h-3 w-3 shrink-0 mt-0.5" />
                  <p>{resolveOrigin(step.tip)}</p>
                </div>
              )}
            </div>
          ))}

          {/* Env vars summary */}
          {guide.envVars && guide.envVars.length > 0 && (
            <div className="mt-4 pt-4 border-t border-divider">
              <p className="eyebrow mb-2 flex items-center gap-1.5">
                <Key className="h-3 w-3" />
                Environment Variables
              </p>
              <div className="space-y-1">
                {guide.envVars.map((v) => (
                  <div
                    key={v.key}
                    className="flex items-baseline gap-3 text-[11px]"
                  >
                    <code className="font-mono text-accent shrink-0">
                      {v.key}
                    </code>
                    <span className="text-text-secondary">—</span>
                    <span className="text-text-secondary">{v.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Page
// ============================================================

const oauthPlatformLabels: Record<string, string> = {
  google: "Google Ads",
  meta: "Meta (Facebook/Instagram)",
  tiktok: "TikTok",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  hubspot: "HubSpot",
};

export default function ConnectionsPage() {
  const searchParams = useSearchParams();
  const connectedPlatform = searchParams.get("connected");
  const oauthError = searchParams.get("error");
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [mode, setMode] = useState<"wizard" | "text">("wizard");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (connectedPlatform) {
      const label = oauthPlatformLabels[connectedPlatform] ?? connectedPlatform;
      setBanner({
        type: "success",
        message: `${label} connected successfully!`,
      });
      window.history.replaceState({}, "", "/dashboard/connections");
    } else if (oauthError) {
      setBanner({ type: "error", message: oauthError });
      window.history.replaceState({}, "", "/dashboard/connections");
    }
  }, [connectedPlatform, oauthError]);

  const filtered = guides.filter((g) => {
    const matchesCategory =
      selectedCategory === "All" || g.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const allEnvVars = guides
    .flatMap((g) => g.envVars ?? [])
    .filter(
      (v, i, arr) => arr.findIndex((a) => a.key === v.key) === i
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Plug className="h-5 w-5 text-accent" />
            <h1 className="text-2xl font-bold text-text font-sans">
              Connections
            </h1>
          </div>
          <p className="text-sm text-text-secondary">
            Connect ad platforms, AI services, analytics, and more to your Growth Console.
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex border border-divider bg-transparent">
          <button
            onClick={() => setMode("wizard")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
              mode === "wizard"
                ? "bg-accent/15 text-accent border-r border-accent/30"
                : "text-text-secondary hover:text-text border-r border-divider"
            }`}
          >
            <Wand2 className="h-3 w-3" />
            Setup Wizard
          </button>
          <button
            onClick={() => setMode("text")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
              mode === "text"
                ? "bg-accent/15 text-accent"
                : "text-text-secondary hover:text-text"
            }`}
          >
            <FileText className="h-3 w-3" />
            Step-by-Step Guides
          </button>
        </div>
      </div>

      {/* OAuth success/error banner */}
      {banner && (
        <div
          className={`flex items-center justify-between p-3 border text-sm ${
            banner.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === "success" ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <span>{banner.message}</span>
          </div>
          <button
            onClick={() => setBanner(null)}
            className="text-current hover:opacity-70 cursor-pointer"
          >
            <span className="text-xs">Dismiss</span>
          </button>
        </div>
      )}

      {mode === "wizard" ? (
        <SetupWizard />
      ) : (
      <>
      {/* Quick start banner */}
      <div className="card p-5 border-accent/20 bg-accent/[0.03]">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-accent/15 border border-accent/30">
            <Zap className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text mb-1">Quick Start</h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              To get your first campaign live, you need at minimum:{" "}
              <span className="text-text">1)</span> An AI engine (Claude — works out of the box with Claude Code),{" "}
              <span className="text-text">2)</span> One ad platform (Google or Meta),{" "}
              <span className="text-text">3)</span> An encryption key for secure credential storage.
              Everything else is optional and can be added later.
            </p>
            <div className="flex gap-2 mt-3">
              <span className="badge bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                Claude AI — Ready
              </span>
              <span className="badge bg-subtle text-text-secondary border-divider">
                Ad Platform — Setup Required
              </span>
              <span className="badge bg-subtle text-text-secondary border-divider">
                Encryption — Setup Required
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search guides..."
          className="bg-transparent border border-divider text-text text-xs px-3 py-2 placeholder-slate-600 focus:border-accent/30 focus:outline-none w-64"
        />
        <div className="flex gap-1.5 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-[10px] font-medium border transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? "bg-accent/10 border-accent text-accent"
                  : "bg-transparent border-divider text-text-secondary hover:border-divider"
              }`}
            >
              {cat}
              {cat !== "All" && (
                <span className="ml-1 text-text-secondary">
                  ({guides.filter((g) => g.category === cat).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Guide List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-text-secondary">No guides found</p>
          </div>
        ) : (
          filtered.map((guide) => <GuideCard key={guide.id} guide={guide} />)
        )}
      </div>

      {/* Full env reference */}
      <div className="card p-5">
        <p className="eyebrow mb-4 flex items-center gap-1.5">
          <Key className="h-3.5 w-3.5" />
          Full Environment Variable Reference
        </p>
        <div className="relative bg-black/30 border border-divider p-4 font-mono text-[11px] leading-[1.8] text-text-secondary whitespace-pre-wrap">
          <CopyButton
            text={allEnvVars.map((v) => `${v.key}=`).join("\n")}
          />
          {allEnvVars.map((v) => (
            <div key={v.key}>
              <span className="text-text-secondary"># {v.description}</span>
              {"\n"}
              <span className="text-accent">{v.key}</span>
              <span className="text-text-secondary">=</span>
              {"\n"}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-text-secondary mt-2">
          Copy this block into your .env file and fill in the values for each
          service you want to use.
        </p>
      </div>
      </>
      )}
    </div>
  );
}
