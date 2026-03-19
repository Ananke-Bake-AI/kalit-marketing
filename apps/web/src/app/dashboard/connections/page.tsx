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
        code: "http://localhost:3000/api/oauth/google/callback",
        tip: "For production, replace localhost:3000 with your actual domain.",
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
    difficulty: "intermediate",
    timeEstimate: "15-20 min",
    steps: [
      {
        title: "Create a Meta App",
        content:
          "Go to Meta for Developers and create a new app. Choose \"Business\" type.",
        link: {
          label: "Meta for Developers",
          url: "https://developers.facebook.com/apps/creation/",
        },
      },
      {
        title: "Add Products to Your App",
        content:
          'In your app dashboard, click "Add Product" and add: Facebook Login, Marketing API.',
      },
      {
        title: "Configure Facebook Login",
        content:
          "Under Facebook Login > Settings, add the OAuth redirect URI:",
        code: "http://localhost:3000/api/oauth/meta/callback",
      },
      {
        title: "Set Required Permissions",
        content:
          "The app will request: ads_management, ads_read, pages_manage_posts, instagram_basic, instagram_content_publish. In App Review, submit these for review (or use a test user for development).",
        tip: "App admins and developers can use all permissions without review while in development mode.",
      },
      {
        title: "Get App Credentials",
        content:
          "Go to App Settings > Basic. Copy your App ID and App Secret.",
      },
      {
        title: "Create a Test Ad Account",
        content:
          "In Meta Business Manager, go to Business Settings > Ad Accounts. Create a test ad account or use an existing sandbox.",
        link: {
          label: "Business Settings",
          url: "https://business.facebook.com/settings/ad-accounts",
        },
      },
      {
        title: "Add Environment Variables",
        content: "Add these to your .env file:",
        code: 'META_CLIENT_ID="your-app-id"\nMETA_CLIENT_SECRET="your-app-secret"',
      },
      {
        title: "Connect from Dashboard",
        content:
          'Click "Connect Meta" in Settings or during onboarding. Authorize the app and select which ad account and pages to connect.',
      },
    ],
    envVars: [
      { key: "META_CLIENT_ID", description: "Meta App ID" },
      { key: "META_CLIENT_SECRET", description: "Meta App Secret" },
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
    timeEstimate: "10-15 min",
    steps: [
      {
        title: "Create a TikTok Business Center Account",
        content:
          "Sign up at TikTok Business Center if you don't have one already.",
        link: {
          label: "TikTok Business Center",
          url: "https://business.tiktok.com/",
        },
      },
      {
        title: "Register a Developer App",
        content:
          "Go to TikTok Marketing API and create a developer application.",
        link: {
          label: "TikTok Marketing API",
          url: "https://business-api.tiktok.com/portal/apps",
        },
      },
      {
        title: "Configure OAuth Redirect",
        content: "Set the callback URL:",
        code: "http://localhost:3000/api/oauth/tiktok/callback",
      },
      {
        title: "Add Environment Variables",
        content: "",
        code: 'TIKTOK_CLIENT_ID="your-app-id"\nTIKTOK_CLIENT_SECRET="your-app-secret"',
      },
      {
        title: "Connect from Dashboard",
        content:
          'Click "Connect TikTok" and complete the OAuth authorization.',
      },
    ],
    envVars: [
      { key: "TIKTOK_CLIENT_ID", description: "TikTok App ID" },
      { key: "TIKTOK_CLIENT_SECRET", description: "TikTok App Secret" },
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
    timeEstimate: "10-15 min",
    steps: [
      {
        title: "Create an X Developer App",
        content:
          "Go to the X Developer Portal and create a new project + app.",
        link: {
          label: "X Developer Portal",
          url: "https://developer.x.com/en/portal/dashboard",
        },
      },
      {
        title: "Enable OAuth 2.0",
        content:
          "In your app settings, enable OAuth 2.0 with PKCE. Set the redirect URI:",
        code: "http://localhost:3000/api/oauth/x/callback",
      },
      {
        title: "Request Elevated Access",
        content:
          "Apply for Elevated access if you need ads API access. Basic access is fine for organic posting.",
        warning:
          "Ads API requires an approved X Ads account + Elevated developer access.",
      },
      {
        title: "Add Environment Variables",
        content: "",
        code: 'X_CLIENT_ID="your-client-id"\nX_CLIENT_SECRET="your-client-secret"',
      },
    ],
    envVars: [
      { key: "X_CLIENT_ID", description: "X OAuth 2.0 Client ID" },
      { key: "X_CLIENT_SECRET", description: "X OAuth 2.0 Client Secret" },
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
    timeEstimate: "10-15 min",
    steps: [
      {
        title: "Create a LinkedIn App",
        content: "Go to LinkedIn Developer Portal and create a new app.",
        link: {
          label: "LinkedIn Developers",
          url: "https://www.linkedin.com/developers/apps/new",
        },
      },
      {
        title: "Request Marketing API Access",
        content:
          'Under "Products", request access to the Marketing Developer Platform. This grants ads_management scopes.',
      },
      {
        title: "Set Redirect URI",
        content: "",
        code: "http://localhost:3000/api/oauth/linkedin/callback",
      },
      {
        title: "Add Environment Variables",
        content: "",
        code: 'LINKEDIN_CLIENT_ID="your-client-id"\nLINKEDIN_CLIENT_SECRET="your-client-secret"',
      },
    ],
    envVars: [
      { key: "LINKEDIN_CLIENT_ID", description: "LinkedIn App Client ID" },
      {
        key: "LINKEDIN_CLIENT_SECRET",
        description: "LinkedIn App Client Secret",
      },
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
  beginner: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
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
      className="absolute top-2 right-2 p-1 text-slate-600 hover:text-white transition-colors cursor-pointer"
      title="Copy"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function GuideCard({ guide }: { guide: Guide }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = guide.icon;

  return (
    <div className="border border-white/5 bg-white/[0.01] hover:border-white/10 transition-colors">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-start gap-4 text-left cursor-pointer"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/10 bg-white/[0.03]">
          <Icon className="h-5 w-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-white">{guide.title}</h3>
            <span
              className={`badge text-[9px] ${difficultyColors[guide.difficulty]}`}
            >
              {guide.difficulty}
            </span>
            <span className="text-[10px] text-slate-600">
              ~{guide.timeEstimate}
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            {guide.description}
          </p>
        </div>
        <div className="shrink-0 mt-1">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
        </div>
      </button>

      {/* Steps */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-5">
          {guide.steps.map((step, i) => (
            <div key={i} className="relative pl-8">
              {/* Step number */}
              <div className="absolute left-0 top-0 flex h-5 w-5 items-center justify-center border border-accent/30 bg-accent/10 text-accent text-[10px] font-bold">
                {i + 1}
              </div>
              {/* Connector line */}
              {i < guide.steps.length - 1 && (
                <div className="absolute left-[9px] top-6 bottom-[-16px] w-px bg-white/5" />
              )}

              <h4 className="text-xs font-semibold text-white mb-1.5">
                {step.title}
              </h4>
              {step.content && (
                <p className="text-xs text-slate-400 leading-relaxed mb-2">
                  {step.content}
                </p>
              )}

              {step.code && (
                <div className="relative bg-black/30 border border-white/5 p-3 font-mono text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap mb-2">
                  <CopyButton text={step.code} />
                  {step.code}
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
                  <p>{step.warning}</p>
                </div>
              )}

              {step.tip && (
                <div className="flex items-start gap-2 p-2 bg-accent/5 border border-accent/20 text-accent/80 text-[11px] mt-2">
                  <Zap className="h-3 w-3 shrink-0 mt-0.5" />
                  <p>{step.tip}</p>
                </div>
              )}
            </div>
          ))}

          {/* Env vars summary */}
          {guide.envVars && guide.envVars.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5">
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
                    <span className="text-slate-600">—</span>
                    <span className="text-slate-500">{v.description}</span>
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
            <h1 className="text-2xl font-bold text-white font-sans">
              Connections
            </h1>
          </div>
          <p className="text-sm text-zinc-500">
            Connect ad platforms, AI services, analytics, and more to your Growth Console.
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex border border-white/10 bg-white/[0.02]">
          <button
            onClick={() => setMode("wizard")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
              mode === "wizard"
                ? "bg-accent/15 text-accent border-r border-accent/30"
                : "text-slate-500 hover:text-white border-r border-white/10"
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
                : "text-slate-500 hover:text-white"
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
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
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
            <h2 className="text-sm font-bold text-white mb-1">Quick Start</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              To get your first campaign live, you need at minimum:{" "}
              <span className="text-white">1)</span> An AI engine (Claude — works out of the box with Claude Code),{" "}
              <span className="text-white">2)</span> One ad platform (Google or Meta),{" "}
              <span className="text-white">3)</span> An encryption key for secure credential storage.
              Everything else is optional and can be added later.
            </p>
            <div className="flex gap-2 mt-3">
              <span className="badge bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                Claude AI — Ready
              </span>
              <span className="badge bg-white/5 text-slate-500 border-white/10">
                Ad Platform — Setup Required
              </span>
              <span className="badge bg-white/5 text-slate-500 border-white/10">
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
          className="bg-white/[0.03] border border-white/10 text-white text-xs px-3 py-2 placeholder-slate-600 focus:border-accent/30 focus:outline-none w-64"
        />
        <div className="flex gap-1.5 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-[10px] font-medium border transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? "bg-accent/10 border-accent text-accent"
                  : "bg-white/[0.02] border-white/5 text-zinc-500 hover:border-white/10"
              }`}
            >
              {cat}
              {cat !== "All" && (
                <span className="ml-1 text-zinc-700">
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
            <p className="text-zinc-500">No guides found</p>
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
        <div className="relative bg-black/30 border border-white/5 p-4 font-mono text-[11px] leading-[1.8] text-slate-400 whitespace-pre-wrap">
          <CopyButton
            text={allEnvVars.map((v) => `${v.key}=`).join("\n")}
          />
          {allEnvVars.map((v) => (
            <div key={v.key}>
              <span className="text-slate-600"># {v.description}</span>
              {"\n"}
              <span className="text-accent">{v.key}</span>
              <span className="text-slate-600">=</span>
              {"\n"}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-600 mt-2">
          Copy this block into your .env file and fill in the values for each
          service you want to use.
        </p>
      </div>
      </>
      )}
    </div>
  );
}
