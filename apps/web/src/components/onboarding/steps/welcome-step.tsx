"use client";

import { Search, Palette, Rocket, TrendingUp } from "lucide-react";

interface WelcomeStepProps {
  workspaceName: string;
  productName: string | null;
  onNext: () => void;
}

const features = [
  {
    icon: Search,
    title: "Research",
    description:
      "AI analyzes your market, competitors, and audience to find growth opportunities.",
  },
  {
    icon: Palette,
    title: "Create",
    description:
      "Generate ad copy, creatives, and content automatically tailored to your brand.",
  },
  {
    icon: Rocket,
    title: "Launch",
    description:
      "Deploy campaigns across Meta, Google, TikTok, and more with one click.",
  },
  {
    icon: TrendingUp,
    title: "Optimize",
    description:
      "Continuously learn from performance data and improve results over time.",
  },
];

export function WelcomeStep({
  workspaceName,
  productName,
  onNext,
}: WelcomeStepProps) {
  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold tracking-[-0.04em] text-white">
          Welcome to your Growth Runtime
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {workspaceName}
          {productName ? ` — ${productName}` : ""}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          Let&apos;s set up your autonomous growth engine in a few steps.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div key={feature.title} className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center border border-accent/20 bg-accent/10">
                  <Icon className="h-3.5 w-3.5 text-accent" />
                </div>
                <h3 className="text-sm font-semibold text-white">
                  {feature.title}
                </h3>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center">
        <button onClick={onNext} className="btn-primary px-8 py-2.5 text-xs">
          Get Started
        </button>
      </div>
    </div>
  );
}
