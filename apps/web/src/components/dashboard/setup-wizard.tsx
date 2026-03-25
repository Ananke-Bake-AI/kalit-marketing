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

/** Replace {ORIGIN} and {IS_LOCALHOST?trueText|falseText} placeholders */
function resolveOrigin(text: string): string {
  if (typeof window === "undefined") return text;
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  // Replace {IS_LOCALHOST?trueContent|falseContent} — use greedy match to handle nested {ORIGIN}
  let resolved = text.replace(/\{IS_LOCALHOST\?([\s\S]*?)\|([\s\S]*?)\}(?![^{]*\})/g, (_match, ifTrue, ifFalse) =>
    isLocalhost ? ifTrue : ifFalse
  );
  // Simpler approach: split on the pattern manually if regex is tricky
  while (resolved.includes("{IS_LOCALHOST?")) {
    const start = resolved.indexOf("{IS_LOCALHOST?");
    const pipeIdx = resolved.indexOf("|", start + 14);
    // Find the matching closing } — skip nested {ORIGIN}
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
  // Replace {ORIGIN}
  resolved = resolved.replace(/\{ORIGIN\}/g, window.location.origin);
  return resolved;
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
  extensionRequired?: boolean;
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
          "Go to Google Cloud Console and create a project (or use an existing one). This project will hold your service account credentials.",
        type: "info",
        link: {
          label: "Google Cloud Console",
          url: "https://console.cloud.google.com/projectcreate",
        },
        tip: "If you already have a GCP project, skip to the next step.",
      },
      {
        id: "enable-api",
        title: "Enable Google Ads API",
        description:
          "In your GCP project:\n\n1. Go to APIs & Services > Library\n2. Search for \"Google Ads API\"\n3. Click Enable",
        type: "info",
        link: {
          label: "Enable Google Ads API",
          url: "https://console.cloud.google.com/apis/library/googleads.googleapis.com",
        },
      },
      {
        id: "service-account",
        title: "Create a Service Account",
        description:
          "A service account lets Kalit manage Google Ads without OAuth redirects or user login.\n\n1. Go to IAM & Admin > Service Accounts\n2. Click \"Create Service Account\"\n3. Name it \"Kalit Marketing\"\n4. Click \"Create and Continue\"\n5. Skip optional role assignment, click \"Done\"\n6. Click on the new service account > Keys tab > Add Key > Create New Key > JSON\n7. Download the JSON key file — you'll paste its contents below",
        type: "info",
        link: {
          label: "Service Accounts",
          url: "https://console.cloud.google.com/iam-admin/serviceaccounts",
        },
        warning: "Store the JSON key securely. It grants full access to your Google Ads through this service account.",
      },
      {
        id: "invite-service-account",
        title: "Invite Service Account to Google Ads",
        description:
          "Give the service account access to your Google Ads account:\n\n1. Log into Google Ads (ads.google.com)\n2. Go to Tools & Settings (wrench icon) > Access and security\n3. Click the \"+\" button to add a user\n4. Paste the service account email (from the JSON key, looks like: kalit-marketing@your-project.iam.gserviceaccount.com)\n5. Set access level to \"Standard\" or \"Admin\"\n6. Click \"Send invitation\"",
        type: "info",
        link: {
          label: "Google Ads",
          url: "https://ads.google.com",
        },
      },
      {
        id: "developer-token",
        title: "Get a Developer Token",
        description:
          "You need a developer token for API access:\n\n1. Sign into Google Ads (ads.google.com)\n2. Go to Tools & Settings > API Center\n3. Copy your developer token\n\nBasic access works with test accounts. Apply for Standard access for production.",
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
      },
      {
        id: "google-credentials",
        title: "Enter Your Credentials",
        description:
          "Paste your service account JSON key contents and Google Ads Customer ID (10-digit number from the top-right of Google Ads, format: xxx-xxx-xxxx).",
        type: "credentials",
        fields: [
          {
            key: "GOOGLE_SERVICE_ACCOUNT_KEY",
            label: "Service Account JSON Key",
            placeholder: '{"type":"service_account","project_id":"..."}',
            secret: true,
          },
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
        tip: "If you have a test account under an MCC, use the test account's Customer ID (not the MCC ID). Test accounts get a $5,000 simulated balance.",
      },
      {
        id: "verify-google",
        title: "Verify Connection",
        description:
          "Let's verify the service account can access your Google Ads account. If it fails:\n\n1. Check the service account email was invited in Google Ads > Access and security\n2. Verify the JSON key is complete (starts with { and ends with })\n3. Check the developer token from API Center\n4. Ensure the Customer ID matches your account",
        type: "verify",
      },
    ],
    verifyKeys: [
      "GOOGLE_SERVICE_ACCOUNT_KEY",
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
        id: "meta-business-suite",
        title: "Open Meta Business Settings",
        description:
          "Go to Meta Business Suite and open Business Settings. You need admin access to the Business Account that owns your ad accounts.\n\nAll Meta Ads configuration (ad accounts, system users, tokens) happens here — NOT in the developer portal.",
        type: "info",
        link: {
          label: "Meta Business Settings",
          url: "https://business.facebook.com/settings/",
        },
      },
      {
        id: "meta-ad-account",
        title: "Link or Create an Ad Account",
        description:
          "In Business Settings:\n\n1. Left sidebar > Accounts > Ad Accounts\n2. Add an existing ad account or create a new one\n3. Set your currency and timezone\n4. Note the Ad Account ID (numeric, starts with \"act_\") — you'll need it in the next steps",
        type: "info",
        link: {
          label: "Business Settings — Ad Accounts",
          url: "https://business.facebook.com/settings/ad-accounts",
        },
      },
      {
        id: "meta-system-user",
        title: "Create a System User",
        description:
          "A System User is a service account that lets Kalit manage ads on your behalf. No OAuth or login flow needed — just a token.\n\nIn Business Settings:\n1. Left sidebar > Users > System Users\n2. Click \"Add\" to create a new system user\n3. Name it \"Kalit Marketing\" (or similar)\n4. Set role to \"Admin\"\n5. Click \"Create System User\"",
        type: "info",
        link: {
          label: "Business Settings — System Users",
          url: "https://business.facebook.com/settings/system-users",
        },
        warning: "You must be an admin of the Business Account to create system users.",
      },
      {
        id: "meta-assign-assets",
        title: "Assign Ad Account to System User",
        description:
          "Give the system user access to your ad account:\n\n1. Click on the system user you just created\n2. Click \"Assign Assets\"\n3. Select \"Ad Accounts\" on the left\n4. Find and select your ad account\n5. Toggle ON \"Full control\" (needed to create/edit campaigns)\n6. Click \"Save Changes\"",
        type: "info",
      },
      {
        id: "meta-generate-token",
        title: "Generate Access Token",
        description:
          "Generate a long-lived token for the system user:\n\n1. On the System Users page, click your system user\n2. Click \"Generate New Token\"\n3. Select the app you created (or any app linked to this business)\n4. Select these permissions:\n   • ads_management\n   • ads_read\n   • business_management\n5. Click \"Generate Token\"\n6. Copy the token immediately — it won't be shown again",
        type: "info",
        warning: "Save the token somewhere secure. It grants full access to your ad accounts and never expires.",
      },
      {
        id: "meta-credentials",
        title: "Enter Your Credentials",
        description:
          "Paste the System User access token and your Ad Account ID below. You can find the Ad Account ID in Business Settings > Ad Accounts (starts with \"act_\").",
        type: "credentials",
        fields: [
          {
            key: "META_ACCESS_TOKEN",
            label: "System User Access Token",
            placeholder: "EAAxxxxxxxxxxxxxxxxxxxxxxxx...",
            secret: true,
          },
          {
            key: "META_AD_ACCOUNT_ID",
            label: "Ad Account ID",
            placeholder: "act_123456789",
            secret: false,
          },
        ],
        tip: "The System User token never expires. No OAuth flow or HTTPS setup needed — Kalit connects directly using this token.",
      },
      {
        id: "verify-meta",
        title: "Verify Connection",
        description: "Let's verify the token works and can access your ad account. If it fails:\n\n1. Token invalid — regenerate it from Business Settings > System Users\n2. No ad account access — make sure you assigned the ad account to the system user with Full Control\n3. Wrong Ad Account ID — check it starts with \"act_\" and matches the account in Business Settings",
        type: "verify",
      },
    ],
    verifyKeys: ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"],
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
        title: "Open TikTok Business Center",
        description: "Go to business.tiktok.com and log in. You need admin access to manage ad accounts and generate API tokens.",
        type: "info",
        link: {
          label: "TikTok Business Center",
          url: "https://business.tiktok.com/",
        },
      },
      {
        id: "tiktok-ad-account",
        title: "Create or Link an Ad Account",
        description: "In TikTok Business Center:\n\n1. Go to Assets > Ad Accounts\n2. Create a new ad account or link an existing one\n3. Set your currency and timezone\n4. Note the Advertiser ID (numeric)",
        type: "info",
        tip: "For testing, TikTok provides a sandbox environment via the Marketing API portal.",
      },
      {
        id: "tiktok-dev-app",
        title: "Register a Developer App",
        description: "Go to the TikTok Marketing API portal:\n\n1. Click \"My Apps\" > \"Create App\"\n2. Select Marketing API\n3. Choose scopes: Ad Management, Creative Management\n4. Submit for review — sandbox access is usually granted quickly",
        type: "info",
        link: {
          label: "TikTok Marketing API Portal",
          url: "https://business-api.tiktok.com/portal/apps",
        },
        warning: "TikTok requires app review before production API access. Sandbox mode is available immediately.",
      },
      {
        id: "tiktok-generate-token",
        title: "Generate a Long-Lived Access Token",
        description: "TikTok advertiser access tokens never expire — no OAuth redirect needed.\n\n1. In the Marketing API portal, go to your app\n2. Click \"Get Authorization\" to connect your advertiser account\n3. Complete the one-time authorization\n4. Copy the Access Token — it's permanent unless you revoke it",
        type: "info",
        tip: "Unlike OAuth tokens that expire, TikTok advertiser tokens are permanent. You only need to do this once.",
      },
      {
        id: "tiktok-credentials",
        title: "Enter Your Credentials",
        description: "Paste your Access Token and Advertiser ID below.",
        type: "credentials",
        fields: [
          {
            key: "TIKTOK_ACCESS_TOKEN",
            label: "Access Token",
            placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            secret: true,
          },
          {
            key: "TIKTOK_ADVERTISER_ID",
            label: "Advertiser ID",
            placeholder: "1234567890123",
            secret: false,
          },
        ],
      },
      {
        id: "verify-tiktok",
        title: "Verify Connection",
        description: "Check that TikTok appears with a green status. If it fails:\n\n1. Token invalid — regenerate from the Marketing API portal\n2. Wrong Advertiser ID — check in Business Center > Assets > Ad Accounts\n3. App not approved — check review status in the portal",
        type: "verify",
      },
    ],
    verifyKeys: ["TIKTOK_ACCESS_TOKEN", "TIKTOK_ADVERTISER_ID"],
  },
  {
    id: "x",
    title: "X (Twitter)",
    description: "Promoted tweets and organic social",
    icon: Globe,
    category: "ad-platform",
    steps: [
      {
        id: "x-ads-account",
        title: "Set Up Your X Ads Account",
        description: "Go to ads.x.com and set up your advertising account with billing info. You need an active ads account to create campaigns.",
        type: "info",
        link: {
          label: "X Ads Manager",
          url: "https://ads.x.com/",
        },
      },
      {
        id: "x-extension",
        title: "Install the Kalit Extension",
        description: "X Ads doesn't provide API access to third parties. Kalit deploys campaigns using a browser extension that automates the X Ads Manager.\n\n1. Download the extension ZIP below\n2. Extract the ZIP to a folder\n3. Open Chrome → chrome://extensions\n4. Enable \"Developer mode\" (top right toggle)\n5. Click \"Load unpacked\" and select the extracted folder\n6. The Kalit icon should appear in your toolbar",
        type: "info",
        link: {
          label: "Download Kalit Extension",
          url: "/api/extension/download",
        },
        tip: "No API keys or OAuth needed for X. The extension fills campaign forms automatically — you review and submit.",
      },
      {
        id: "verify-x",
        title: "Verify Extension",
        description: "Click the Kalit extension icon in your browser toolbar — it should show \"Status: Ready\". Then create a campaign in the dashboard and click \"Deploy to X\".\n\nIf the icon doesn't appear, check chrome://extensions and make sure the extension is enabled.",
        type: "verify",
      },
    ],
    verifyKeys: [],
    extensionRequired: true,
  },
  {
    id: "linkedin",
    title: "LinkedIn Ads",
    description: "Sponsored content and B2B lead gen",
    icon: Globe,
    category: "ad-platform",
    steps: [
      {
        id: "linkedin-app",
        title: "Create a LinkedIn App",
        description: "Go to linkedin.com/developers and sign in:\n\n1. Click \"Create App\"\n2. App name: \"Kalit Marketing\"\n3. LinkedIn Page: select your company page (required)\n4. Add a Privacy Policy URL and logo\n5. Click Create",
        type: "info",
        link: {
          label: "LinkedIn Developers",
          url: "https://www.linkedin.com/developers/apps/new",
        },
        warning: "You must be an admin of the LinkedIn Company Page to create the app.",
      },
      {
        id: "linkedin-marketing",
        title: "Request Marketing API Access",
        description: "In your app dashboard:\n\n1. Go to the \"Products\" tab\n2. Find \"Marketing Developer Platform\"\n3. Click \"Request access\"\n\nThis grants ads management scopes (r_ads, rw_ads). Approval can take a few days.",
        type: "info",
        warning: "Without Marketing Developer Platform approval, you can only do organic posting. Ads management requires it.",
      },
      {
        id: "linkedin-redirect",
        title: "Configure Redirect URL",
        description: "Go to the \"Auth\" tab in your app dashboard. Under \"Authorized redirect URLs\", add the URL below. LinkedIn requires OAuth for ad management — there's no service account option.",
        type: "redirect",
        code: "{ORIGIN}/api/oauth/linkedin/callback",
        tip: "LinkedIn supports http://localhost for development — no HTTPS tunnel needed.",
      },
      {
        id: "linkedin-credentials",
        title: "Enter Your Credentials",
        description: "In the \"Auth\" tab, copy your Client ID and Client Secret (click the eye icon to reveal).",
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
        id: "connect-linkedin",
        title: "Connect Your LinkedIn Account",
        description: "Click below to authorize. You'll be redirected to LinkedIn to grant permissions, then back here. Make sure you have a Campaign Manager account at linkedin.com/campaignmanager with billing set up.",
        type: "action",
        actionLabel: "Connect LinkedIn",
        actionUrl: "/api/oauth/linkedin",
      },
      {
        id: "verify-linkedin",
        title: "Verify Connection",
        description: "Check that LinkedIn appears with a green status. If it fails:\n\n1. Redirect URL mismatch — check the Auth tab\n2. Marketing Developer Platform not approved yet\n3. Not an admin of the Company Page\n4. No Campaign Manager account at linkedin.com/campaignmanager",
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
      <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">
        {resolveOrigin(step.description)}
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
          <p>{resolveOrigin(step.warning)}</p>
        </div>
      )}

      {/* Tip */}
      {step.tip && (
        <div className="flex items-start gap-2 p-2 bg-accent/5 border border-accent/20 text-accent/80 text-[11px] mt-2">
          <Zap className="h-3 w-3 shrink-0 mt-0.5" />
          <p>{resolveOrigin(step.tip)}</p>
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
      const platform = platformWizards.find((p) => p.id === activePlatform);

      // For extension-based platforms (X), check extension instead of API keys
      if (platform?.extensionRequired) {
        // The bridge sets data-kalit-extension="true" on <html> when loaded
        let extensionDetected = document.documentElement.getAttribute("data-kalit-extension") === "true";
        // Fallback: listen for the event in case it fires late
        if (!extensionDetected) {
          extensionDetected = await new Promise<boolean>((resolve) => {
            const handler = () => { resolve(true); window.removeEventListener("kalit-extension-ready", handler); };
            window.addEventListener("kalit-extension-ready", handler);
            setTimeout(() => { resolve(false); window.removeEventListener("kalit-extension-ready", handler); }, 1500);
          });
        }
        setVerificationResults((prev) => ({
          ...prev,
          [activePlatform]: {
            keysConfigured: { "Kalit Extension": extensionDetected },
            allKeysConfigured: extensionDetected,
            oauthRequired: false,
            oauthConnected: false,
            accountName: null,
            ready: extensionDetected,
          },
        }));
        return;
      }

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
