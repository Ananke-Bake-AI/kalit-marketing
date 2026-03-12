"use client";

import { useState } from "react";
import { Check, Circle, Rocket, Loader2 } from "lucide-react";

interface LaunchStepProps {
  workspaceId: string;
  connectedAccounts: Array<{
    platform: string;
    accountName: string | null;
    isActive: boolean;
  }>;
  config: {
    monthlyBudget: number | null;
    primaryGoal: string | null;
    currency: string;
  } | null;
  creativesCount: number;
  campaignsCount: number;
  onComplete: () => void;
  onDismiss: () => void;
  onBack: () => void;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function LaunchStep({
  workspaceId,
  connectedAccounts,
  config,
  creativesCount,
  campaignsCount,
  onComplete,
  onDismiss,
  onBack,
}: LaunchStepProps) {
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePlatforms = connectedAccounts.filter((a) => a.isActive);
  const hasBudget = !!config?.monthlyBudget;
  const hasGoal = !!config?.primaryGoal;
  const hasContent = creativesCount > 0;

  const checkItems = [
    {
      label: "Connected platforms",
      done: activePlatforms.length > 0,
      detail:
        activePlatforms.length > 0
          ? activePlatforms.map((a) => a.accountName || a.platform).join(", ")
          : "No platforms connected",
    },
    {
      label: "Budget",
      done: hasBudget,
      detail:
        hasBudget && config
          ? formatCurrency(config.monthlyBudget!, config.currency)
          : "Not set",
    },
    {
      label: "Primary goal",
      done: hasGoal,
      detail: hasGoal ? config!.primaryGoal!.replace(/_/g, " ") : "Not set",
    },
    {
      label: "Content created",
      done: hasContent,
      detail: hasContent
        ? `${creativesCount} creative${creativesCount !== 1 ? "s" : ""}`
        : "No content yet",
    },
  ];

  const handleLaunch = async () => {
    setLaunching(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: "auditing",
            trigger: "request",
            reason: "Onboarding complete",
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to launch");
      }

      // Dismiss onboarding and complete
      if (typeof window !== "undefined") {
        localStorage.setItem(
          `kalit-onboarding-dismissed-${workspaceId}`,
          "true"
        );
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-[-0.04em] text-white">
          Ready to Launch
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Review your setup and start the autonomous growth cycle.
        </p>
      </div>

      {/* Checklist */}
      <div className="mb-8 max-w-lg">
        <p className="eyebrow mb-3">Setup Summary</p>
        <div className="space-y-2">
          {checkItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 border border-white/5 bg-white/[0.02] p-3"
            >
              {item.done ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-slate-600" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs font-medium ${
                    item.done ? "text-white" : "text-slate-500"
                  }`}
                >
                  {item.label}
                </p>
                <p
                  className={`text-[10px] ${
                    item.done ? "text-slate-400" : "text-slate-600"
                  } truncate`}
                >
                  {item.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {campaignsCount > 0 && (
        <div className="mb-4 border border-accent/20 bg-accent/5 p-3">
          <p className="text-xs text-accent">
            {campaignsCount} campaign{campaignsCount !== 1 ? "s" : ""} already
            created. The growth runtime is active.
          </p>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={onBack}
          className="btn-secondary px-4 py-2 text-xs"
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={onDismiss}
            className="text-xs text-slate-600 transition-colors hover:text-slate-400"
          >
            Go to Dashboard
          </button>
          <button
            onClick={handleLaunch}
            disabled={launching}
            className="btn-primary px-6 py-2 text-xs disabled:opacity-50"
          >
            {launching ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Launching...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Rocket className="h-3.5 w-3.5" />
                Launch First Campaign
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
