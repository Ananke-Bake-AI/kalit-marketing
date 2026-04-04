"use client";

import { useState } from "react";

interface BudgetStepProps {
  workspaceId: string;
  config: {
    monthlyBudget: number | null;
    currency: string;
    primaryGoal: string | null;
    targetCac: number | null;
    targetRoas: number | null;
  } | null;
  onComplete: () => void;
  onBack: () => void;
}

export function BudgetStep({
  workspaceId,
  config,
  onComplete,
  onBack,
}: BudgetStepProps) {
  const [form, setForm] = useState({
    monthlyBudget: config?.monthlyBudget?.toString() ?? "",
    currency: config?.currency ?? "USD",
    primaryGoal: config?.primaryGoal ?? "signups",
    targetCac: config?.targetCac?.toString() ?? "",
    targetRoas: config?.targetRoas?.toString() ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyBudget: form.monthlyBudget
            ? parseFloat(form.monthlyBudget)
            : null,
          currency: form.currency,
          primaryGoal: form.primaryGoal,
          targetCac: form.targetCac ? parseFloat(form.targetCac) : null,
          targetRoas: form.targetRoas ? parseFloat(form.targetRoas) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save config");
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-[-0.04em] text-text">
          Budget & Goals
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          Define your growth budget and success metrics.
        </p>
      </div>

      <div className="max-w-xl space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-text-secondary">
              Monthly Budget
            </label>
            <input
              type="number"
              value={form.monthlyBudget}
              onChange={(e) => update("monthlyBudget", e.target.value)}
              placeholder="5000"
              className="input w-full"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-text-secondary">
              Currency
            </label>
            <select
              value={form.currency}
              onChange={(e) => update("currency", e.target.value)}
              className="input w-full"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-text-secondary">
            Primary Goal
          </label>
          <select
            value={form.primaryGoal}
            onChange={(e) => update("primaryGoal", e.target.value)}
            className="input w-full"
          >
            <option value="signups">Signups</option>
            <option value="leads">Qualified Leads</option>
            <option value="demos">Booked Demos</option>
            <option value="revenue">Revenue</option>
            <option value="awareness">Brand Awareness</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-text-secondary">
              Target CAC
            </label>
            <input
              type="number"
              value={form.targetCac}
              onChange={(e) => update("targetCac", e.target.value)}
              placeholder="50"
              className="input w-full"
            />
            <p className="mt-1 text-[10px] text-text-secondary">
              Max cost per acquisition (optional)
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-text-secondary">
              Target ROAS
            </label>
            <input
              type="number"
              value={form.targetRoas}
              onChange={(e) => update("targetRoas", e.target.value)}
              placeholder="3.0"
              className="input w-full"
            />
            <p className="mt-1 text-[10px] text-text-secondary">
              Minimum return on ad spend (optional)
            </p>
          </div>
        </div>

        {error && (
          <div className="border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={onBack}
          className="btn-secondary px-4 py-2 text-xs"
        >
          Back
        </button>
        <button
          onClick={handleSave}
          disabled={submitting || !form.monthlyBudget || !form.primaryGoal}
          className="btn-primary px-6 py-2 text-xs disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save & Continue"}
        </button>
      </div>
    </div>
  );
}
