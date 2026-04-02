"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Globe, FolderOpen, Link2, DollarSign, Palette, Rocket } from "lucide-react";
import { WelcomeStep } from "./steps/welcome-step";
import { ContextStep } from "./steps/context-step";
import { BrandAssetsStep } from "./steps/brand-assets-step";
import { ConnectStep } from "./steps/connect-step";
import { BudgetStep } from "./steps/budget-step";
import { ContentStep } from "./steps/content-step";
import { LaunchStep } from "./steps/launch-step";

type StepKey = "welcome" | "context" | "brand_assets" | "connect" | "budget" | "content" | "launch";

interface OnboardingGuideProps {
  workspaceId: string;
  workspaceName: string;
  config: {
    productName: string;
    productDescription: string;
    monthlyBudget: number | null;
    primaryGoal: string | null;
    targetCac: number | null;
    targetRoas: number | null;
    currency: string;
  } | null;
  connectedAccounts: Array<{
    id: string;
    platform: string;
    accountName: string | null;
    isActive: boolean;
  }>;
  assetsCount: number;
  creativesCount: number;
  campaignsCount: number;
  memoriesCount: number;
}

const steps: { key: StepKey; label: string; icon: React.ElementType }[] = [
  { key: "welcome", label: "Welcome", icon: Sparkles },
  { key: "context", label: "Context", icon: Globe },
  { key: "brand_assets", label: "Brand Assets", icon: FolderOpen },
  { key: "connect", label: "Connect", icon: Link2 },
  { key: "budget", label: "Budget & Goals", icon: DollarSign },
  { key: "content", label: "Create Content", icon: Palette },
  { key: "launch", label: "Launch", icon: Rocket },
];

export function OnboardingGuide({
  workspaceId,
  workspaceName,
  config,
  connectedAccounts,
  assetsCount,
  creativesCount,
  campaignsCount,
  memoriesCount,
}: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState<StepKey>("welcome");
  const [dismissed, setDismissed] = useState(false);

  const isStepComplete = useCallback(
    (key: StepKey): boolean => {
      switch (key) {
        case "welcome":
          return true;
        case "context":
          return memoriesCount >= 1;
        case "brand_assets":
          return assetsCount >= 1;
        case "connect":
          return connectedAccounts.length >= 1;
        case "budget":
          return !!(config?.monthlyBudget && config?.primaryGoal);
        case "content":
          return creativesCount >= 1;
        case "launch":
          return campaignsCount >= 1;
        default:
          return false;
      }
    },
    [connectedAccounts.length, config?.monthlyBudget, config?.primaryGoal, assetsCount, creativesCount, campaignsCount, memoriesCount]
  );

  // Check localStorage dismissal
  useEffect(() => {
    if (typeof window !== "undefined") {
      const key = `kalit-onboarding-dismissed-${workspaceId}`;
      if (localStorage.getItem(key) === "true") {
        setDismissed(true);
      }
    }
  }, [workspaceId]);

  // Auto-advance to first incomplete step on mount
  useEffect(() => {
    for (const step of steps) {
      if (!isStepComplete(step.key)) {
        setCurrentStep(step.key);
        return;
      }
    }
    setCurrentStep("launch");
  }, [isStepComplete]);

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        `kalit-onboarding-dismissed-${workspaceId}`,
        "true"
      );
    }
    setDismissed(true);
  };

  const handleComplete = () => {
    window.location.reload();
  };

  if (dismissed) return null;

  const stepIndex = steps.findIndex((s) => s.key === currentStep);

  const goToStep = (key: StepKey) => setCurrentStep(key);
  const goNext = () => {
    if (stepIndex < steps.length - 1) {
      setCurrentStep(steps[stepIndex + 1].key);
    }
  };
  const goBack = () => {
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1].key);
    }
  };

  return (
    <div>
      {/* Header with Skip */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="eyebrow mb-1">Setup Guide</p>
          <p className="text-xs text-slate-500">
            Complete these steps to activate your growth runtime.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-[10px] text-slate-600 transition-colors hover:text-slate-400"
        >
          Skip Setup
        </button>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-1 overflow-x-auto">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isActive = step.key === currentStep;
          const isDone = isStepComplete(step.key) && !isActive;
          return (
            <div key={step.key} className="flex items-center gap-1">
              {i > 0 && (
                <span className="text-[10px] text-slate-700">&rsaquo;</span>
              )}
              <button
                onClick={() => goToStep(step.key)}
                className={`flex items-center gap-2 whitespace-nowrap px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] transition-all ${
                  isActive
                    ? "border border-accent/30 bg-accent/20 text-accent"
                    : isDone
                      ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                      : "border border-white/5 bg-white/[0.03] text-slate-600"
                }`}
              >
                <Icon className="h-3 w-3" />
                {step.label}
              </button>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="panel-surface p-8">
        {currentStep === "welcome" && (
          <WelcomeStep
            workspaceName={workspaceName}
            productName={config?.productName ?? null}
            onNext={goNext}
          />
        )}

        {currentStep === "context" && (
          <ContextStep
            workspaceId={workspaceId}
            hasContext={memoriesCount > 0}
            onComplete={goNext}
            onBack={goBack}
          />
        )}

        {currentStep === "brand_assets" && (
          <BrandAssetsStep
            workspaceId={workspaceId}
            assetsCount={assetsCount}
            onComplete={goNext}
            onBack={goBack}
            onSkip={goNext}
          />
        )}

        {currentStep === "connect" && (
          <ConnectStep
            workspaceId={workspaceId}
            connectedAccounts={connectedAccounts}
            onComplete={goNext}
            onSkip={goNext}
          />
        )}

        {currentStep === "budget" && (
          <BudgetStep
            workspaceId={workspaceId}
            config={config}
            onComplete={goNext}
            onBack={goBack}
          />
        )}

        {currentStep === "content" && (
          <ContentStep
            workspaceId={workspaceId}
            creativesCount={creativesCount}
            onComplete={goNext}
            onBack={goBack}
          />
        )}

        {currentStep === "launch" && (
          <LaunchStep
            workspaceId={workspaceId}
            connectedAccounts={connectedAccounts}
            config={config}
            creativesCount={creativesCount}
            campaignsCount={campaignsCount}
            onComplete={handleComplete}
            onDismiss={handleDismiss}
            onBack={goBack}
          />
        )}
      </div>
    </div>
  );
}
