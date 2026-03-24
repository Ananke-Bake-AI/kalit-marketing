"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Check,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Save,
  Shield,
  AlertTriangle,
  Zap,
  Search,
  Megaphone,
  Monitor,
  Globe,
  Bot,
  Plug,
  Lock,
  ArrowRight,
  CircleDot,
  CheckCircle2,
  Circle,
} from "lucide-react";

/** Replace {ORIGIN} placeholders with the current browser origin */
function resolveOrigin(text: string): string {
  if (typeof window === "undefined") return text;
  return text.replace(/\{ORIGIN\}/g, window.location.origin);
}

// ============================================================
// Types
// ============================================================

interface WizardField {
  key: string;
  label: string;
  placeholder: string;
  secret?: boolean;
  link?: { label: string; url: string };
}

interface WizardStep {
  id: string;
  title: string;
  description: string;
  type: "info" | "credentials" | "action" | "redirect" | "verify" | "account-config";
  fields?: WizardField[];
  link?: { label: string; url: string };
  warning?: string;
  tip?: string;
  code?: string;
  codes?: { label: string; value: string }[];
  actionLabel?: string;
  actionUrl?: string;
}

interface PlatformWizard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  category: "ad-platform" | "ai-service" | "infrastructure";
  steps: WizardStep[];
  verifyKeys: string[];
}

// ============================================================
// Platform Wizard Definitions
// ============================================================

const platformWizards: PlatformWizard[] = [
  {
    id: "google",
    title: "Google Ads",
    description: "Search, Display & Performance Max campaigns",
    icon: Search,
    category: "ad-platform",
    steps: [
      {
        id: "gcp-project",
        title: "Create a Google Cloud Project",
        description:
          "You need a GCP project to hold your OAuth credentials. Create one or use an existing project.",
        type: "info",
        link: {
          label: "Open Google Cloud Console",
          url: "https://console.cloud.google.com/projectcreate",
        },
        tip: "If you already have a GCP project, skip to the next step.",
      },
      {
        id: "enable-api",
        title: "Enable Google Ads API",
        description:
          'In your GCP project, go to APIs & Services > Library. Search for "Google Ads API" and click Enable.',
        type: "info",
        link: {
          label: "Open API Library",
          url: "https://console.cloud.google.com/apis/library/googleads.googleapis.com",
        },
      },
      {
        id: "oauth-consent",
        title: "Configure OAuth Consent Screen",
        description:
          'Set up the consent screen: go to APIs & Services > OAuth consent screen. Select "External" user type, fill in your app name, and add your email as a test user.',
        type: "info",
        link: {
          label: "OAuth Consent Screen",
          url: "https://console.cloud.google.com/apis/credentials/consent",
        },
        tip: 'Stay in "Testing" mode — no Google verification needed for test accounts.',
      },
      {
        id: "create-oauth",
        title: "Create OAuth 2.0 Credentials",
        description:
          'Go to Credentials > Create Credentials > OAuth 2.0 Client ID. Select "Web application". Add the redirect URI shown below.',
        type: "redirect",
        code: "{ORIGIN}/api/oauth/google/callback",
        link: {
          label: "Create Credentials",
          url: "https://console.cloud.google.com/apis/credentials",
        },
        tip: "The URL shown matches your current environment. For production, add your domain as an additional redirect URI.",
      },
      {
        id: "google-credentials",
        title: "Enter Your OAuth Credentials",
        description:
          "Paste the Client ID and Client Secret from the credentials you just created.",
        type: "credentials",
        fields: [
          {
            key: "GOOGLE_CLIENT_ID",
            label: "Client ID",
            placeholder: "xxxxx.apps.googleusercontent.com",
            secret: false,
          },
          {
            key: "GOOGLE_CLIENT_SECRET",
            label: "Client Secret",
            placeholder: "GOCSPX-...",
            secret: true,
          },
        ],
      },
      {
        id: "developer-token",
        title: "Get a Developer Token",
        description:
          "Sign into Google Ads, go to Tools & Settings > API Center. Copy your developer token.",
        type: "credentials",
        fields: [
          {
            key: "GOOGLE_ADS_DEVELOPER_TOKEN",
            label: "Developer Token",
            placeholder: "xxxxxxxxxxxxxxxxxxxx",
            secret: true,
            link: {
              label: "Google Ads API Center",
              url: "https://ads.google.com/aw/apicenter",
            },
          },
        ],
        warning:
          "Basic access tokens work only with test accounts. Apply for Standard access for production.",
      },
      {
        id: "test-account",
        title: "Create a Test Account (Optional)",
        description:
          'For safe testing without spending real money, create a test account: Google Ads > Tools > Account Manager > Create test account. You get a $5,000 simulated balance.',
        type: "info",
        link: {
          label: "Google Ads Manager",
          url: "https://ads.google.com/aw/accountmanager",
        },
        tip: "Test accounts simulate everything but cannot serve real ads. Perfect for development.",
      },
      {
        id: "connect-google",
        title: "Connect Your Google Account",
        description:
          "Click the button below to authorize via OAuth. You'll be redirected to Google, then back here.",
        type: "action",
        actionLabel: "Connect Google Ads",
        actionUrl: "/api/oauth/google",
      },
      {
        id: "google-customer-id",
        title: "Enter Your Google Ads Customer ID",
        description:
          "Your Customer ID is the 10-digit number shown in the top-right of Google Ads (format: xxx-xxx-xxxx). This tells us which Ads account to push campaigns to.",
        type: "account-config",
        fields: [
          {
            key: "GOOGLE_ADS_CUSTOMER_ID",
            label: "Customer ID",
            placeholder: "123-456-7890",
            secret: false,
            link: {
              label: "Open Google Ads",
              url: "https://ads.google.com",
            },
          },
        ],
        tip: "If you have a test account under an MCC, use the test account's Customer ID (not the MCC ID).",
      },
      {
        id: "verify-google",
        title: "Verify Connection",
        description:
          "Let's verify everything is configured correctly.",
        type: "verify",
      },
    ],
    verifyKeys: [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_ADS_DEVELOPER_TOKEN",
    ],
  },
  {
    id: "meta",
    title: "Meta Ads",
    description: "Facebook & Instagram paid social campaigns",
    icon: Megaphone,
    category: "ad-platform",
    steps: [
      {
        id: "go-to-meta-dev",
        title: "Go to Meta for Developers",
        description:
          "Open developers.facebook.com and log in with the Facebook account that owns or is admin of your business. If you don't have a developer account yet, click \"Get Started\" and follow the registration.",
        type: "info",
        link: {
          label: "Meta for Developers",
          url: "https://developers.facebook.com/",
        },
      },
      {
        id: "create-meta-app",
        title: "Create a New App — App Details",
        description:
          "Click \"My Apps\" > \"Create App\". In the first step (App Details), enter your app name (e.g. \"Kalit Marketing\") and your contact email.",
        type: "info",
        link: {
          label: "Create New App",
          url: "https://developers.facebook.com/apps/creation/",
        },
      },
      {
        id: "meta-use-cases",
        title: "Select Use Cases",
        description:
          "In the second step (Use Cases), you'll see a list of available APIs. Check the following:\n\n• \"Create and manage ads with the Marketing API\" — this is required for ad campaigns\n• Optionally: \"Authenticate and request data from users\" (Facebook Login) — for OAuth\n\nDo NOT select Gaming, WhatsApp, or Threads unless you need them. Click Next.",
        type: "info",
        tip: "The Marketing API use case is the most important one. It enables creating campaigns, ad sets, and ads programmatically.",
      },
      {
        id: "meta-business-account",
        title: "Associate a Business Account",
        description:
          "In the third step (Business), select your Meta Business Account (formerly Business Manager). If you don't have one, you'll be prompted to create it. This links your app to your business for ad account access and permissions. You must be an admin.",
        type: "info",
        link: {
          label: "Meta Business Suite",
          url: "https://business.facebook.com/",
        },
        warning: "You must be an admin of the Business Account to connect ad accounts and grant permissions.",
      },
      {
        id: "meta-finalize-app",
        title: "Review & Create the App",
        description:
          "Review the Requirements step (any prerequisites for your selected use cases), then complete the Overview to create the app. Once created, you'll land on the app dashboard.",
        type: "info",
      },
      {
        id: "meta-redirect",
        title: "Configure OAuth Redirect URI",
        description:
          "Go to Facebook Login > Settings in the left sidebar (under \"Products\", not \"App Settings\"). Turn off \"Enforce HTTPS\" to allow localhost in development mode. Then under \"Valid OAuth Redirect URIs\", add this callback URL:",
        type: "redirect",
        code: "{ORIGIN}/api/oauth/meta/callback",
        tip: "HTTP localhost only works while your app is in Development mode. For production, keep Enforce HTTPS on and use your real domain (e.g. https://marketing.kalit.ai/api/oauth/meta/callback).",
      },
      {
        id: "meta-permissions",
        title: "Understand Required Permissions",
        description:
          "The OAuth flow requests: ads_management (create/edit campaigns), ads_read (read performance), pages_manage_posts (publish to Pages), instagram_basic (IG account info), instagram_content_publish (post to IG). In development mode, app admins get all permissions without review.",
        type: "info",
        warning: "In development mode, only users listed as admins/developers/testers in your app's Roles settings can authorize. Add your team there.",
      },
      {
        id: "meta-credentials",
        title: "Enter Your App Credentials",
        description:
          "Go to App Settings > Basic. Copy your App ID (numeric) and App Secret (click \"Show\" to reveal). Paste them below.",
        type: "credentials",
        fields: [
          {
            key: "META_CLIENT_ID",
            label: "App ID",
            placeholder: "123456789012345",
            secret: false,
          },
          {
            key: "META_CLIENT_SECRET",
            label: "App Secret",
            placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            secret: true,
          },
        ],
        warning: "Never share your App Secret publicly. It grants full access to your app.",
      },
      {
        id: "meta-ad-account",
        title: "Create or Link an Ad Account",
        description:
          "In Meta Business Suite > Business Settings > Ad Accounts: create a new ad account or link an existing one. Set your currency and timezone. The Ad Account ID (starts with \"act_\") is used to push campaigns.",
        type: "info",
        link: {
          label: "Business Settings — Ad Accounts",
          url: "https://business.facebook.com/settings/ad-accounts",
        },
      },
      {
        id: "connect-meta",
        title: "Connect Your Meta Account",
        description:
          "Click below to start the OAuth flow. You'll be redirected to Facebook to review permissions and select your ad account. After authorization, you'll be redirected back.",
        type: "action",
        actionLabel: "Connect Meta Ads",
        actionUrl: "/api/oauth/meta",
      },
      {
        id: "verify-meta",
        title: "Verify Connection",
        description: "Check that Meta appears with a green status and your account name. If it fails: 1) Verify App ID/Secret are correct, 2) Redirect URI matches exactly, 3) Your Facebook account has admin access to the Business Account.",
        type: "verify",
      },
    ],
    verifyKeys: ["META_CLIENT_ID", "META_CLIENT_SECRET"],
  },
  {
    id: "tiktok",
    title: "TikTok Ads",
    description: "Video ads and spark ads",
    icon: Monitor,
    category: "ad-platform",
    steps: [
      {
        id: "tiktok-business",
        title: "Go to TikTok Business Center",
        description: "Open business.tiktok.com and sign in. If you don't have an account, click \"Create an account\" — you'll need a business name, industry, and timezone.",
        type: "info",
        link: {
          label: "TikTok Business Center",
          url: "https://business.tiktok.com/",
        },
      },
      {
        id: "tiktok-ad-account",
        title: "Create an Ad Account",
        description: "In TikTok Business Center, go to Assets > Ad Accounts and create one. Set your currency and timezone. You need an active ad account to run campaigns through the API.",
        type: "info",
        tip: "For testing, TikTok provides a sandbox environment. You can request sandbox access when creating your developer app.",
      },
      {
        id: "tiktok-dev-app",
        title: "Register a Developer App",
        description: "Go to the TikTok Marketing API portal. Click \"My Apps\" > \"Create App\". Select Marketing API, choose scopes: Ad Management, Creative Management. Submit for review — sandbox access is usually granted quickly.",
        type: "info",
        link: {
          label: "TikTok Marketing API Portal",
          url: "https://business-api.tiktok.com/portal/apps",
        },
        warning: "TikTok requires app review before production API access. Sandbox mode is available immediately for testing.",
      },
      {
        id: "tiktok-redirect",
        title: "Configure OAuth Redirect URI",
        description: "In your app settings, add the callback URL:",
        type: "redirect",
        code: "{ORIGIN}/api/oauth/tiktok/callback",
      },
      {
        id: "tiktok-credentials",
        title: "Enter Your Credentials",
        description: "In the app dashboard, find your App ID and App Secret. Copy both values and paste them below.",
        type: "credentials",
        fields: [
          {
            key: "TIKTOK_CLIENT_ID",
            label: "App ID",
            placeholder: "xxxxxxxxxx",
            secret: false,
          },
          {
            key: "TIKTOK_CLIENT_SECRET",
            label: "App Secret",
            placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            secret: true,
          },
        ],
      },
      {
        id: "connect-tiktok",
        title: "Connect Your TikTok Account",
        description: "Click below to start the OAuth flow. Grant access to your ad account on TikTok's authorization page.",
        type: "action",
        actionLabel: "Connect TikTok",
        actionUrl: "/api/oauth/tiktok",
      },
      {
        id: "verify-tiktok",
        title: "Verify Connection",
        description: "Check that TikTok appears with a green status. If it fails, ensure your app has been approved and the redirect URI matches exactly.",
        type: "verify",
      },
    ],
    verifyKeys: ["TIKTOK_CLIENT_ID", "TIKTOK_CLIENT_SECRET"],
  },
  {
    id: "x",
    title: "X (Twitter)",
    description: "Promoted tweets and organic social",
    icon: Globe,
    category: "ad-platform",
    steps: [
      {
        id: "x-console",
        title: "Go to the X Developer Console",
        description: "Open console.x.com and sign in with the X account you want to use for advertising. If you don't have a developer account yet, you'll be prompted to sign up.",
        type: "info",
        link: {
          label: "X Developer Console",
          url: "https://console.x.com/",
        },
        tip: "X uses a pay-per-use credit model. You can buy credits or enable auto-recharge from the Billing section.",
      },
      {
        id: "x-create-app",
        title: "Create an App",
        description: "In the console, click \"Apps\" in the left sidebar, then \"Create App\". Enter a name (e.g. \"Kalit Marketing\") and save. You'll land on the app detail page showing a Bearer Token and OAuth 1.0 Keys. Ignore those for now — we need OAuth 2.0.",
        type: "info",
      },
      {
        id: "x-oauth-setup",
        title: "Set Up User Authentication (OAuth 2.0)",
        description: "On your app's detail page, scroll to \"User authentication settings\" and click \"Set up\". You'll go through 3 screens:\n\n1. App permissions → select \"Read and write\"\n2. Type of App → select \"Web App, Automated App or Bot\"\n3. App info — two required fields (copy each below). The other fields (Organization, Terms of Service, Privacy Policy) are optional.\n\nClick Save.",
        type: "redirect",
        codes: [
          { label: "Callback URI / Redirect URL (required)", value: "{ORIGIN}/api/oauth/x/callback" },
          { label: "Website URL (required)", value: "https://kalit.ai" },
        ],
        tip: "The Website URL is informational only — it doesn't affect the OAuth flow. Only the Callback URI must match exactly.",
      },
      {
        id: "x-credentials",
        title: "Enter Your OAuth 2.0 Credentials",
        description: "After saving User authentication settings, your OAuth 2.0 Client ID and Client Secret are generated. Copy them immediately — the Client Secret is only shown once.\n\nThey appear separately from the OAuth 1.0 keys (Consumer Key / Access Token) that were shown when you first created the app. Make sure you're copying from the OAuth 2.0 section.",
        type: "credentials",
        fields: [
          {
            key: "X_CLIENT_ID",
            label: "OAuth 2.0 Client ID",
            placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx",
            secret: false,
          },
          {
            key: "X_CLIENT_SECRET",
            label: "OAuth 2.0 Client Secret",
            placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            secret: true,
          },
        ],
        warning: "The OAuth 2.0 Client ID & Secret are NOT the same as the Consumer Key & Access Token shown at the top of the page. Those are OAuth 1.0a credentials.",
      },
      {
        id: "x-ads-access",
        title: "Request Ads API Access",
        description: "To run paid campaigns (promoted tweets, ad management, audience targeting), you need Ads API access:\n\n1. Go to ads.x.com and set up your advertising account with billing info\n2. Then go to ads.x.com/help and submit an Ads API access application\n3. Choose \"Standard Access\" for full campaign management (analytics, creatives, audiences)\n4. After approval, regenerate your user access tokens in the Developer Console\n\nApproval may take a few days. You can proceed to connect your account now — the OAuth connection works independently from Ads API access.",
        type: "info",
        link: {
          label: "X Ads",
          url: "https://ads.x.com/",
        },
        tip: "\"Standard Access\" is what you need for full campaign management. \"Conversion Only\" is limited to tracking only.",
      },
      {
        id: "connect-x",
        title: "Connect Your X Account",
        description: "Click below to start the OAuth flow. You'll be redirected to X to authorize the app. After approval, you'll be redirected back with a success message.",
        type: "action",
        actionLabel: "Connect X",
        actionUrl: "/api/oauth/x",
      },
      {
        id: "verify-x",
        title: "Verify Connection",
        description: "Check that X appears with a green status and your @handle. If it fails: 1) Callback URL must match exactly (no trailing slash mismatch), 2) Use OAuth 2.0 credentials (not API Key/Secret), 3) Ensure OAuth 2.0 is enabled in your app settings.",
        type: "verify",
      },
    ],
    verifyKeys: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
  },
  {
    id: "linkedin",
    title: "LinkedIn Ads",
    description: "Sponsored content and B2B lead gen",
    icon: Globe,
    category: "ad-platform",
    steps: [
      {
        id: "linkedin-portal",
        title: "Go to LinkedIn Developer Portal",
        description: "Open linkedin.com/developers and sign in with the LinkedIn account that manages your company page. Click \"Create App\".",
        type: "info",
        link: {
          label: "LinkedIn Developers",
          url: "https://www.linkedin.com/developers/apps/new",
        },
      },
      {
        id: "linkedin-app",
        title: "Create a LinkedIn App",
        description: "Fill in: App name (e.g. \"Kalit Marketing\"), LinkedIn Page (select your company — required), Privacy policy URL, and App logo.",
        type: "info",
        tip: "You must be an admin of the LinkedIn Company Page to associate it with the app.",
      },
      {
        id: "linkedin-marketing",
        title: "Request Marketing Developer Platform Access",
        description: "In your app dashboard, go to the \"Products\" tab. Find \"Marketing Developer Platform\" and click \"Request access\". This grants the ads management scopes (r_ads, rw_ads). Approval can take a few days.",
        type: "info",
        warning: "Without Marketing Developer Platform access, you can only do organic posting. Ads management requires product approval.",
      },
      {
        id: "linkedin-redirect",
        title: "Configure OAuth Redirect URL",
        description: "Go to the \"Auth\" tab. Under \"Authorized redirect URLs\", add:",
        type: "redirect",
        code: "{ORIGIN}/api/oauth/linkedin/callback",
      },
      {
        id: "linkedin-credentials",
        title: "Enter Your Credentials",
        description: "In the \"Auth\" tab, copy your Client ID and Client Secret (click the eye icon to reveal). Paste them below.",
        type: "credentials",
        fields: [
          {
            key: "LINKEDIN_CLIENT_ID",
            label: "Client ID",
            placeholder: "xxxxxxxxxxxxxx",
            secret: false,
          },
          {
            key: "LINKEDIN_CLIENT_SECRET",
            label: "Client Secret",
            placeholder: "xxxxxxxxxxxxxxxx",
            secret: true,
          },
        ],
      },
      {
        id: "linkedin-campaign-manager",
        title: "Set Up LinkedIn Campaign Manager",
        description: "Go to linkedin.com/campaignmanager to create or access your Campaign Manager account. Set up billing to run paid sponsored content.",
        type: "info",
        link: {
          label: "LinkedIn Campaign Manager",
          url: "https://www.linkedin.com/campaignmanager/",
        },
      },
      {
        id: "connect-linkedin",
        title: "Connect Your LinkedIn Account",
        description: "Click below to authorize. You'll be redirected to LinkedIn's consent screen.",
        type: "action",
        actionLabel: "Connect LinkedIn",
        actionUrl: "/api/oauth/linkedin",
      },
      {
        id: "verify-linkedin",
        title: "Verify Connection",
        description: "Check that LinkedIn appears with a green status. If it fails: 1) Redirect URL matches exactly, 2) Marketing Developer Platform is approved, 3) You're an admin of the associated Company Page.",
        type: "verify",
      },
    ],
    verifyKeys: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
  },
  {
    id: "anthropic",
    title: "Claude AI",
    description: "Powers campaign generation, research & optimization",
    icon: Bot,
    category: "ai-service",
    steps: [
      {
        id: "ai-choice",
        title: "Choose Your AI Setup",
        description:
          "Option A: Use an Anthropic API key (production). Option B: Use local Claude Code session (development — no key needed, just leave blank).",
        type: "info",
        link: {
          label: "Get API Key",
          url: "https://console.anthropic.com/settings/keys",
        },
        tip: "If you have Claude Code installed, the system auto-detects your local session. No API key required for development.",
      },
      {
        id: "anthropic-key",
        title: "Enter API Key (Optional)",
        description:
          "If using Anthropic API directly, paste your key. Leave blank to use local Claude Code session.",
        type: "credentials",
        fields: [
          {
            key: "ANTHROPIC_API_KEY",
            label: "Anthropic API Key",
            placeholder: "sk-ant-api03-...",
            secret: true,
          },
        ],
      },
      {
        id: "verify-ai",
        title: "Verify AI Engine",
        description: "Check that the AI engine is reachable.",
        type: "verify",
      },
    ],
    verifyKeys: ["ANTHROPIC_API_KEY"],
  },
  {
    id: "encryption",
    title: "Encryption Key",
    description: "Secure storage for all platform tokens",
    icon: Shield,
    category: "infrastructure",
    steps: [
      {
        id: "gen-key",
        title: "Generate an Encryption Key",
        description:
          "Run this command in your terminal to generate a random 32-byte encryption key:",
        type: "info",
        code: "openssl rand -hex 32",
        warning:
          "If you lose this key, all stored credentials become unreadable. Back it up securely.",
      },
      {
        id: "encryption-input",
        title: "Enter Encryption Key",
        description: "Paste the 64-character hex key you generated.",
        type: "credentials",
        fields: [
          {
            key: "ENCRYPTION_KEY",
            label: "Encryption Key (64 hex chars)",
            placeholder: "a1b2c3d4e5f6...",
            secret: true,
          },
        ],
      },
      {
        id: "verify-encryption",
        title: "Verify Encryption",
        description: "Check that the encryption key is valid.",
        type: "verify",
      },
    ],
    verifyKeys: ["ENCRYPTION_KEY"],
  },
];

// ============================================================
// Wizard Component
// ============================================================

interface KeyStatus {
  set: boolean;
  masked: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-[10px] text-slate-600 hover:text-accent transition-colors cursor-pointer"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function AccountConfigFields({
  fields,
  workspaceId,
  platformId,
}: {
  fields: WizardField[];
  workspaceId: string;
  platformId: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load existing config on mount
  useEffect(() => {
    if (!workspaceId || loaded) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/connections/${platformId}/config`
        );
        if (res.ok) {
          const data = await res.json();
          const metadata = data.metadata ?? {};
          const initial: Record<string, string> = {};
          for (const field of fields) {
            if (field.key === "GOOGLE_ADS_CUSTOMER_ID" && metadata.customerId) {
              initial[field.key] = String(metadata.customerId);
            } else if (metadata[field.key]) {
              initial[field.key] = String(metadata[field.key]);
            }
          }
          if (Object.keys(initial).length > 0) {
            setValues(initial);
          }
        }
      } catch {
        // ignore — will just show empty fields
      } finally {
        setLoaded(true);
      }
    })();
  }, [workspaceId, platformId, fields, loaded]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // Build the config payload
      const config: Record<string, string> = {};
      for (const field of fields) {
        const val = values[field.key]?.trim();
        if (val) {
          // Map known keys to API fields
          if (field.key === "GOOGLE_ADS_CUSTOMER_ID") {
            config.customerId = val;
          } else {
            config[field.key] = val;
          }
        }
      }

      if (Object.keys(config).length === 0) return;

      const res = await fetch(
        `/api/workspaces/${workspaceId}/connections/${platformId}/config`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const hasValues = Object.values(values).some((v) => v.trim());

  return (
    <div className="space-y-3 mt-2">
      {fields.map((field) => (
        <div key={field.key}>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] text-slate-500 font-medium">
              {field.label}
            </label>
            {field.link && (
              <a
                href={field.link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-accent/60 hover:text-accent transition-colors"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                {field.link.label}
              </a>
            )}
          </div>
          <input
            type="text"
            value={values[field.key] ?? ""}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
            }
            placeholder={field.placeholder}
            className="w-full bg-white/[0.03] border border-white/10 text-xs px-3 py-2 font-mono text-white placeholder-slate-700 focus:outline-none focus:border-accent/30 transition-colors"
          />
        </div>
      ))}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={!hasValues || saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors disabled:opacity-30 cursor-pointer"
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          Save
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
            <Check className="h-3 w-3" />
            Saved to account
          </span>
        )}
        {error && (
          <span className="text-[10px] text-red-400">{error}</span>
        )}
      </div>
    </div>
  );
}

function WizardStepContent({
  step,
  keyStatuses,
  onSaveKeys,
  saving,
  workspaceId,
  platformId,
  verificationResult,
  onVerify,
  verifying,
}: {
  step: WizardStep;
  keyStatuses: Record<string, KeyStatus>;
  onSaveKeys: (keys: Record<string, string>) => Promise<void>;
  saving: boolean;
  workspaceId: string;
  platformId: string;
  verificationResult: VerificationResult | null;
  onVerify: () => void;
  verifying: boolean;
}) {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showFields, setShowFields] = useState<Record<string, boolean>>({});
  const [localSaved, setLocalSaved] = useState(false);

  const hasValues = Object.values(fieldValues).some((v) => v.trim());

  async function handleSave() {
    const toSave: Record<string, string> = {};
    for (const [key, value] of Object.entries(fieldValues)) {
      if (value.trim()) toSave[key] = value.trim();
    }
    if (Object.keys(toSave).length === 0) return;
    await onSaveKeys(toSave);
    setLocalSaved(true);
    setFieldValues({});
    setTimeout(() => setLocalSaved(false), 3000);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400 leading-relaxed">
        {step.description}
      </p>

      {step.code && (
        <div className="relative bg-black/40 border border-white/5 p-3 font-mono text-[11px] text-slate-300 leading-relaxed">
          <div className="absolute top-2 right-2">
            <CopyButton text={resolveOrigin(step.code)} />
          </div>
          {resolveOrigin(step.code)}
        </div>
      )}

      {step.codes && (
        <div className="space-y-2">
          {step.codes.map((c, i) => (
            <div key={i}>
              <p className="text-[10px] text-slate-500 font-medium mb-1">{c.label}</p>
              <div className="relative bg-black/40 border border-white/5 p-3 font-mono text-[11px] text-slate-300 leading-relaxed">
                <div className="absolute top-2 right-2">
                  <CopyButton text={resolveOrigin(c.value)} />
                </div>
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
          className="inline-flex items-center gap-1.5 text-[11px] text-accent hover:text-accent/80 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          {step.link.label}
          <ArrowRight className="h-3 w-3" />
        </a>
      )}

      {/* Credential inputs */}
      {step.type === "credentials" && step.fields && (
        <div className="space-y-3 mt-2">
          {step.fields.map((field) => {
            const status = keyStatuses[field.key];
            const isVisible = showFields[field.key];
            const currentValue = fieldValues[field.key] ?? "";
            const isConfigured = status?.set && !currentValue;

            return (
              <div key={field.key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-500 font-medium">
                    {field.label}
                    {isConfigured && (
                      <span className="ml-2 text-emerald-400/70">
                        <Check className="h-3 w-3 inline mr-0.5" />
                        {status.masked}
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    {field.link && (
                      <a
                        href={field.link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-accent/60 hover:text-accent transition-colors"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                        {field.link.label}
                      </a>
                    )}
                    {field.secret && (
                      <button
                        onClick={() =>
                          setShowFields((prev) => ({
                            ...prev,
                            [field.key]: !prev[field.key],
                          }))
                        }
                        className="text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
                      >
                        {isVisible ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type={field.secret && !isVisible ? "password" : "text"}
                  value={currentValue}
                  onChange={(e) =>
                    setFieldValues((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  placeholder={
                    isConfigured
                      ? `Already configured (${status.masked})`
                      : field.placeholder
                  }
                  className={`w-full bg-white/[0.03] border text-xs px-3 py-2 font-mono placeholder-slate-700 focus:outline-none transition-colors ${
                    isConfigured
                      ? "border-emerald-500/20 focus:border-emerald-500/40"
                      : "border-white/10 focus:border-accent/30"
                  } text-white`}
                />
              </div>
            );
          })}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!hasValues || saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors disabled:opacity-30 cursor-pointer"
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              Save
            </button>
            {localSaved && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <Check className="h-3 w-3" />
                Saved
              </span>
            )}
          </div>
        </div>
      )}

      {/* OAuth connect action */}
      {step.type === "action" && step.actionUrl && (
        <div className="mt-2">
          <a
            href={`${step.actionUrl}?workspaceId=${workspaceId}`}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-accent text-black hover:bg-accent/90 transition-colors"
          >
            <Plug className="h-3.5 w-3.5" />
            {step.actionLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
          {!workspaceId && (
            <p className="text-[10px] text-yellow-400 mt-2">
              <AlertTriangle className="h-3 w-3 inline mr-1" />
              Select a workspace first to connect an account.
            </p>
          )}
        </div>
      )}

      {/* Account config (e.g., Google Ads Customer ID) */}
      {step.type === "account-config" && step.fields && (
        <AccountConfigFields
          fields={step.fields}
          workspaceId={workspaceId}
          platformId={platformId}
        />
      )}

      {/* Verification */}
      {step.type === "verify" && (
        <div className="mt-2 space-y-3">
          <button
            onClick={onVerify}
            disabled={verifying}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-white/5 text-white border border-white/10 hover:border-white/20 transition-colors cursor-pointer disabled:opacity-50"
          >
            {verifying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Shield className="h-3.5 w-3.5" />
            )}
            Run Verification
          </button>

          {verificationResult && (
            <div
              className={`p-3 border text-xs space-y-2 ${
                verificationResult.ready
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : "bg-yellow-500/10 border-yellow-500/20"
              }`}
            >
              <div className="flex items-center gap-2">
                {verificationResult.ready ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                )}
                <span
                  className={
                    verificationResult.ready
                      ? "text-emerald-400 font-medium"
                      : "text-yellow-400 font-medium"
                  }
                >
                  {verificationResult.ready
                    ? "All checks passed!"
                    : "Some items need attention"}
                </span>
              </div>
              <div className="space-y-1 pl-6">
                {Object.entries(verificationResult.keysConfigured).map(
                  ([key, configured]) => (
                    <div
                      key={key}
                      className="flex items-center gap-2 text-[11px]"
                    >
                      {configured ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Circle className="h-3 w-3 text-slate-600" />
                      )}
                      <code className="font-mono text-slate-400">{key}</code>
                      <span
                        className={
                          configured ? "text-emerald-400" : "text-slate-600"
                        }
                      >
                        {configured ? "Configured" : "Missing"}
                      </span>
                    </div>
                  )
                )}
                {verificationResult.oauthRequired && (
                  <div className="flex items-center gap-2 text-[11px]">
                    {verificationResult.oauthConnected ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Circle className="h-3 w-3 text-slate-600" />
                    )}
                    <span className="text-slate-400">OAuth Connected</span>
                    <span
                      className={
                        verificationResult.oauthConnected
                          ? "text-emerald-400"
                          : "text-slate-600"
                      }
                    >
                      {verificationResult.oauthConnected
                        ? verificationResult.accountName ?? "Connected"
                        : "Not connected"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Warning */}
      {step.warning && (
        <div className="flex items-start gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[11px] mt-2">
          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
          <p>{step.warning}</p>
        </div>
      )}

      {/* Tip */}
      {step.tip && (
        <div className="flex items-start gap-2 p-2 bg-accent/5 border border-accent/20 text-accent/80 text-[11px] mt-2">
          <Zap className="h-3 w-3 shrink-0 mt-0.5" />
          <p>{step.tip}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Verification Result Type
// ============================================================

interface VerificationResult {
  platform: string;
  keysConfigured: Record<string, boolean>;
  allKeysConfigured: boolean;
  oauthRequired: boolean;
  oauthConnected: boolean;
  accountName: string | null;
  ready: boolean;
}

// ============================================================
// Main Setup Wizard
// ============================================================

interface Workspace {
  id: string;
  name: string;
}

export function SetupWizard() {
  const [activePlatform, setActivePlatform] = useState<string>("google");
  const [activeStep, setActiveStep] = useState<number>(0);
  const [keyStatuses, setKeyStatuses] = useState<Record<string, KeyStatus>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState("");
  const [verificationResults, setVerificationResults] = useState<
    Record<string, VerificationResult>
  >({});
  const [verifying, setVerifying] = useState(false);

  const wizard = platformWizards.find((w) => w.id === activePlatform)!;

  // Load key statuses + workspaces
  useEffect(() => {
    Promise.all([
      fetch("/api/platform-keys").then((r) => r.json()),
      fetch("/api/workspaces").then((r) => r.json()),
    ])
      .then(([keys, ws]) => {
        setKeyStatuses(keys);
        setWorkspaces(ws);
        if (ws.length > 0) setSelectedWorkspace(ws[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const refreshKeyStatuses = useCallback(async () => {
    try {
      const data = await fetch("/api/platform-keys").then((r) => r.json());
      setKeyStatuses(data);
    } catch {
      // ignore
    }
  }, []);

  async function handleSaveKeys(keys: Record<string, string>) {
    setSaving(true);
    try {
      const res = await fetch("/api/platform-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(keys),
      });
      if (res.ok) {
        await refreshKeyStatuses();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    try {
      const res = await fetch("/api/platform-keys/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: activePlatform,
          workspaceId: selectedWorkspace,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setVerificationResults((prev) => ({
          ...prev,
          [activePlatform]: data,
        }));
      }
    } catch {
      // ignore
    } finally {
      setVerifying(false);
    }
  }

  // Determine completed steps per platform from keyStatuses
  function getPlatformStatus(
    platform: PlatformWizard
  ): "not-started" | "in-progress" | "complete" {
    const vr = verificationResults[platform.id];
    if (vr?.ready) return "complete";

    const hasAnyKey = platform.verifyKeys.some((k) => keyStatuses[k]?.set);
    if (hasAnyKey) return "in-progress";
    return "not-started";
  }

  function isStepAccessible(_stepIndex: number): boolean {
    // All steps are always clickable — user can jump to any step
    return true;
  }

  function getStepStatus(
    step: WizardStep,
    _index: number
  ): "complete" | "current" | "upcoming" {
    if (step.type === "credentials" && step.fields) {
      const allSet = step.fields.every((f) => keyStatuses[f.key]?.set);
      if (allSet) return "complete";
    }
    if (step.type === "verify") {
      const vr = verificationResults[activePlatform];
      if (vr?.ready) return "complete";
    }
    return "upcoming";
  }

  if (loading) {
    return (
      <div className="card p-12 text-center">
        <Loader2 className="h-5 w-5 animate-spin mx-auto text-accent" />
        <p className="text-sm text-zinc-500 mt-3">Loading setup wizard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workspace selector */}
      {workspaces.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-[11px] text-slate-500 font-medium">
            Workspace:
          </label>
          <select
            value={selectedWorkspace}
            onChange={(e) => setSelectedWorkspace(e.target.value)}
            className="bg-white/[0.03] border border-white/10 text-white text-xs px-3 py-1.5 focus:border-accent/30 focus:outline-none"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Platform Progress Tracker */}
      <div className="card p-4">
        <p className="eyebrow mb-3">Platform Setup Progress</p>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {platformWizards.map((pw) => {
            const status = getPlatformStatus(pw);
            const Icon = pw.icon;
            const isActive = activePlatform === pw.id;

            return (
              <button
                key={pw.id}
                onClick={() => {
                  setActivePlatform(pw.id);
                  setActiveStep(0);
                }}
                className={`p-3 border text-left transition-all cursor-pointer ${
                  isActive
                    ? "border-accent/40 bg-accent/5"
                    : status === "complete"
                      ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50"
                      : status === "in-progress"
                        ? "border-yellow-500/20 bg-yellow-500/5 hover:border-yellow-500/40"
                        : "border-white/5 bg-white/[0.01] hover:border-white/10"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-3.5 w-3.5 text-slate-400" />
                  {status === "complete" && (
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  )}
                  {status === "in-progress" && (
                    <CircleDot className="h-3 w-3 text-yellow-400" />
                  )}
                </div>
                <p className="text-[11px] font-medium text-white truncate">
                  {pw.title}
                </p>
                <p className="text-[9px] text-slate-600 truncate">
                  {status === "complete"
                    ? "Ready"
                    : status === "in-progress"
                      ? "In progress"
                      : "Not started"}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Wizard */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Step navigation sidebar */}
        <div className="card p-4 space-y-1 h-fit">
          <div className="flex items-center gap-2 mb-3">
            {(() => {
              const Icon = wizard.icon;
              return <Icon className="h-4 w-4 text-accent" />;
            })()}
            <div>
              <p className="text-sm font-bold text-white">{wizard.title}</p>
              <p className="text-[10px] text-slate-600">
                {wizard.description}
              </p>
            </div>
          </div>

          {wizard.steps.map((step, i) => {
            const status = getStepStatus(step, i);
            const accessible = isStepAccessible(i);
            const isCurrent = i === activeStep;

            return (
              <button
                key={step.id}
                onClick={() => accessible && setActiveStep(i)}
                disabled={!accessible}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[11px] transition-colors cursor-pointer ${
                  isCurrent
                    ? "bg-accent/10 border-l-2 border-accent text-white"
                    : status === "complete"
                      ? "text-emerald-400/70 hover:bg-white/[0.02]"
                      : accessible
                        ? "text-slate-500 hover:bg-white/[0.02] hover:text-slate-300"
                        : "text-slate-700 cursor-not-allowed"
                }`}
              >
                {status === "complete" ? (
                  <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                ) : isCurrent ? (
                  <ChevronRight className="h-3 w-3 text-accent shrink-0" />
                ) : (
                  <span className="w-3 h-3 flex items-center justify-center text-[9px] font-bold text-slate-600 shrink-0">
                    {i + 1}
                  </span>
                )}
                <span className="truncate">{step.title}</span>
              </button>
            );
          })}
        </div>

        {/* Step content */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-slate-600 font-mono">
                  Step {activeStep + 1}/{wizard.steps.length}
                </span>
                <span
                  className={`badge text-[9px] ${
                    wizard.steps[activeStep].type === "credentials" || wizard.steps[activeStep].type === "account-config"
                      ? "bg-accent/15 text-accent border-accent/30"
                      : wizard.steps[activeStep].type === "action"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : wizard.steps[activeStep].type === "verify"
                          ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                          : "bg-white/5 text-slate-500 border-white/10"
                  }`}
                >
                  {wizard.steps[activeStep].type === "credentials" || wizard.steps[activeStep].type === "account-config"
                    ? "Input required"
                    : wizard.steps[activeStep].type === "action"
                      ? "Action required"
                      : wizard.steps[activeStep].type === "verify"
                        ? "Verification"
                        : wizard.steps[activeStep].type === "redirect"
                          ? "Configuration"
                          : "Information"}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white">
                {wizard.steps[activeStep].title}
              </h3>
            </div>
          </div>

          <WizardStepContent
            step={wizard.steps[activeStep]}
            keyStatuses={keyStatuses}
            onSaveKeys={handleSaveKeys}
            saving={saving}
            workspaceId={selectedWorkspace}
            platformId={activePlatform}
            verificationResult={verificationResults[activePlatform] ?? null}
            onVerify={handleVerify}
            verifying={verifying}
          />

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
            <button
              onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
              disabled={activeStep === 0}
              className="text-xs text-slate-500 hover:text-white transition-colors disabled:opacity-30 cursor-pointer"
            >
              Previous
            </button>
            {activeStep < wizard.steps.length - 1 ? (
              <button
                onClick={() => setActiveStep(activeStep + 1)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Next Step
                <ChevronRight className="h-3 w-3" />
              </button>
            ) : (
              <span className="text-[10px] text-slate-600">
                Last step — run verification above
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-2 p-3 bg-accent/5 border border-accent/20 text-accent/80 text-[11px]">
        <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <p>
          All credentials are stored locally on your server at{" "}
          <code className="font-mono text-accent">.credentials/platform-keys.json</code>{" "}
          and never sent to third parties. They&apos;re used only for OAuth flows
          and API calls to the respective platforms.
        </p>
      </div>
    </div>
  );
}
