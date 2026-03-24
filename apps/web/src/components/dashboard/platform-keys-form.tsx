"use client";

import { useEffect, useState } from "react";
import {
  Key,
  Save,
  Loader2,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Shield,
} from "lucide-react";

interface KeyStatus {
  set: boolean;
  masked: string;
}

interface KeyField {
  key: string;
  label: string;
  placeholder: string;
  link?: { label: string; url: string };
}

interface KeyGroup {
  title: string;
  icon: string;
  fields: KeyField[];
}

const keyGroups: KeyGroup[] = [
  {
    title: "Google Ads",
    icon: "search",
    fields: [
      {
        key: "GOOGLE_CLIENT_ID",
        label: "Client ID",
        placeholder: "xxxxx.apps.googleusercontent.com",
        link: {
          label: "GCP Credentials",
          url: "https://console.cloud.google.com/apis/credentials",
        },
      },
      {
        key: "GOOGLE_CLIENT_SECRET",
        label: "Client Secret",
        placeholder: "GOCSPX-...",
      },
      {
        key: "GOOGLE_ADS_DEVELOPER_TOKEN",
        label: "Developer Token",
        placeholder: "xxxxxxxxxxxxxxxxxxxx",
        link: {
          label: "API Center",
          url: "https://ads.google.com/aw/apicenter",
        },
      },
    ],
  },
  {
    title: "Meta (Facebook & Instagram)",
    icon: "megaphone",
    fields: [
      {
        key: "META_CLIENT_ID",
        label: "App ID",
        placeholder: "123456789012345",
        link: {
          label: "Meta for Developers",
          url: "https://developers.facebook.com/apps/",
        },
      },
      {
        key: "META_CLIENT_SECRET",
        label: "App Secret",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      },
    ],
  },
  {
    title: "TikTok",
    icon: "monitor",
    fields: [
      {
        key: "TIKTOK_CLIENT_ID",
        label: "App ID",
        placeholder: "xxxxxxxxxx",
        link: {
          label: "Marketing API Portal",
          url: "https://business-api.tiktok.com/portal/apps",
        },
      },
      {
        key: "TIKTOK_CLIENT_SECRET",
        label: "App Secret",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      },
    ],
  },
  {
    title: "X (Twitter)",
    icon: "globe",
    fields: [
      {
        key: "X_CLIENT_ID",
        label: "OAuth 2.0 Client ID",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx",
        link: {
          label: "Developer Console",
          url: "https://console.x.com/",
        },
      },
      {
        key: "X_CLIENT_SECRET",
        label: "OAuth 2.0 Client Secret",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      },
    ],
  },
  {
    title: "LinkedIn",
    icon: "globe",
    fields: [
      {
        key: "LINKEDIN_CLIENT_ID",
        label: "Client ID",
        placeholder: "xxxxxxxxxxxxxx",
        link: {
          label: "Developer Apps",
          url: "https://www.linkedin.com/developers/apps",
        },
      },
      {
        key: "LINKEDIN_CLIENT_SECRET",
        label: "Client Secret",
        placeholder: "xxxxxxxxxxxxxxxx",
      },
    ],
  },
  {
    title: "Reddit",
    icon: "globe",
    fields: [
      {
        key: "REDDIT_CLIENT_ID",
        label: "Client ID",
        placeholder: "xxxxxxxxxxxxxx",
        link: {
          label: "Reddit Apps",
          url: "https://www.reddit.com/prefs/apps",
        },
      },
      {
        key: "REDDIT_CLIENT_SECRET",
        label: "Client Secret",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      },
    ],
  },
  {
    title: "Encryption",
    icon: "shield",
    fields: [
      {
        key: "ENCRYPTION_KEY",
        label: "Encryption Key (64 hex chars)",
        placeholder: "Run: openssl rand -hex 32",
      },
    ],
  },
];

export function PlatformKeysForm() {
  const [statuses, setStatuses] = useState<Record<string, KeyStatus>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/platform-keys")
      .then((r) => r.json())
      .then((data) => {
        setStatuses(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    // Only send keys that the user actually filled in
    const toSave: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value.trim()) {
        toSave[key] = value.trim();
      }
    }

    if (Object.keys(toSave).length === 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/platform-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSave),
      });

      if (res.ok) {
        setSaved(true);
        setValues({});
        // Refresh statuses
        const data = await fetch("/api/platform-keys").then((r) => r.json());
        setStatuses(data);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = Object.values(values).some((v) => v.trim());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-bold text-white">
            Platform API Credentials
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <Check className="h-3 w-3" />
              Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors disabled:opacity-30 cursor-pointer"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            Save Credentials
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 bg-accent/5 border border-accent/20 text-accent/80 text-[11px]">
        <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <p>
          Credentials are stored locally on your server and never sent to
          third parties. They&apos;re used only for OAuth flows and API calls to the
          respective platforms.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading...
        </div>
      ) : (
        <div className="space-y-4">
          {keyGroups.map((group) => (
            <div
              key={group.title}
              className="border border-white/5 bg-white/[0.01]"
            >
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  {group.title}
                </p>
              </div>
              <div className="p-4 space-y-3">
                {group.fields.map((field) => {
                  const status = statuses[field.key];
                  const isVisible = showValues[field.key];
                  const currentValue = values[field.key] ?? "";

                  return (
                    <div key={field.key}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-500 font-medium">
                          {field.label}
                          {status?.set && !currentValue && (
                            <span className="ml-2 text-emerald-400/70">
                              ({status.masked})
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
                          <button
                            onClick={() =>
                              setShowValues((prev) => ({
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
                        </div>
                      </div>
                      <input
                        type={isVisible ? "text" : "password"}
                        value={currentValue}
                        onChange={(e) =>
                          handleChange(field.key, e.target.value)
                        }
                        placeholder={
                          status?.set
                            ? `Already configured (${status.masked})`
                            : field.placeholder
                        }
                        className={`w-full bg-white/[0.03] border text-xs px-3 py-2 font-mono placeholder-slate-700 focus:outline-none transition-colors ${
                          status?.set && !currentValue
                            ? "border-emerald-500/20 focus:border-emerald-500/40"
                            : "border-white/10 focus:border-accent/30"
                        } text-white`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
