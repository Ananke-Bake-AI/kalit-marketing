"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Target,
  Palette,
  DollarSign,
  Shield,
  Link2,
  Check,
} from "lucide-react";
import Link from "next/link";

type Step = "product" | "icp" | "brand" | "budget" | "autonomy";

const steps: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: "product", label: "Product", icon: Building2 },
  { key: "icp", label: "Target", icon: Target },
  { key: "brand", label: "Brand", icon: Palette },
  { key: "budget", label: "Budget", icon: DollarSign },
  { key: "autonomy", label: "Autonomy", icon: Shield },
];

export default function NewWorkspacePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("product");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    productName: "",
    productDescription: "",
    productUrl: "",
    industry: "",
    stage: "launch" as string,
    icpDescription: "",
    brandVoice: "",
    monthlyBudget: "",
    currency: "USD",
    targetGeographies: "",
    primaryGoal: "signups" as string,
    targetCac: "",
    targetRoas: "",
    autonomyMode: "approval" as string,
    shareConnections: true,
  });

  // Fetch existing shareable connections from other workspaces
  const [existingConnections, setExistingConnections] = useState<
    Array<{ platform: string; accountName: string | null; workspaceName: string }>
  >([]);

  useEffect(() => {
    fetch("/api/workspaces/shareable-connections")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setExistingConnections(data);
      })
      .catch(() => {});
  }, []);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const stepIndex = steps.findIndex((s) => s.key === currentStep);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          shareConnections: form.shareConnections,
          config: {
            productName: form.productName,
            productDescription: form.productDescription,
            productUrl: form.productUrl || undefined,
            industry: form.industry || undefined,
            stage: form.stage || undefined,
            icpDescription: form.icpDescription || undefined,
            brandVoice: form.brandVoice || undefined,
            monthlyBudget: form.monthlyBudget
              ? parseFloat(form.monthlyBudget)
              : undefined,
            currency: form.currency,
            targetGeographies: form.targetGeographies
              ? form.targetGeographies.split(",").map((g) => g.trim())
              : [],
            primaryGoal: form.primaryGoal || undefined,
            targetCac: form.targetCac
              ? parseFloat(form.targetCac)
              : undefined,
            targetRoas: form.targetRoas
              ? parseFloat(form.targetRoas)
              : undefined,
            autonomyMode: form.autonomyMode,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create workspace");
      }

      const workspace = await res.json();
      router.push(`/dashboard/workspaces/${workspace.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-2 border border-divider bg-transparent px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.24em] text-text-secondary transition-all hover:border-accent/20 hover:text-text"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Dashboard
        </Link>
        <p className="eyebrow mb-2">Onboarding</p>
        <h1 className="text-xl font-bold tracking-[-0.04em] text-text">
          New Growth Workspace
        </h1>
        <p className="mt-1 text-xs text-text-secondary">
          Set up a new autonomous growth runtime for a client
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-1">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isActive = step.key === currentStep;
          const isDone = i < stepIndex;
          return (
            <div key={step.key} className="flex items-center gap-1">
              {i > 0 && (
                <span className="text-[10px] text-text-secondary">&rsaquo;</span>
              )}
              <button
                onClick={() => setCurrentStep(step.key)}
                className={`flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] transition-all ${
                  isActive
                    ? "border border-accent/30 bg-accent/20 text-accent"
                    : isDone
                      ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-600"
                      : "border border-divider bg-transparent text-text-secondary"
                }`}
              >
                <Icon className="h-3 w-3" />
                {step.label}
              </button>
            </div>
          );
        })}
      </div>

      {/* Form */}
      <div className="card-white max-w-2xl p-8">
        {currentStep === "product" && (
          <div className="space-y-5">
            <p className="section-title mb-6">Startup & Product</p>
            <Field
              label="Workspace Name"
              value={form.name}
              onChange={(v) => update("name", v)}
              placeholder="e.g. Acme Corp"
            />
            <Field
              label="Slug"
              value={form.slug}
              onChange={(v) => update("slug", v)}
              placeholder="e.g. acme-corp"
              hint="URL-friendly identifier (auto-generated if empty)"
            />
            <Field
              label="Product Name"
              value={form.productName}
              onChange={(v) => update("productName", v)}
              placeholder="e.g. Acme Analytics"
            />
            <TextAreaField
              label="Product Description"
              value={form.productDescription}
              onChange={(v) => update("productDescription", v)}
              placeholder="Describe what the product does, who it's for, and what problem it solves..."
            />
            <Field
              label="Product URL"
              value={form.productUrl}
              onChange={(v) => update("productUrl", v)}
              placeholder="https://..."
            />
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Industry"
                value={form.industry}
                onChange={(v) => update("industry", v)}
                placeholder="e.g. SaaS, E-commerce"
              />
              <SelectField
                label="Stage"
                value={form.stage}
                onChange={(v) => update("stage", v)}
                options={[
                  { value: "launch", label: "Launch" },
                  { value: "validation", label: "Validation" },
                  { value: "growth", label: "Growth" },
                  { value: "scale", label: "Scale" },
                ]}
              />
            </div>
          </div>
        )}

        {currentStep === "icp" && (
          <div className="space-y-5">
            <p className="section-title mb-6">Ideal Customer Profile</p>
            <TextAreaField
              label="ICP Description"
              value={form.icpDescription}
              onChange={(v) => update("icpDescription", v)}
              placeholder="Describe your ideal customer: role, company size, pain points, buying behavior..."
              rows={6}
            />
            <SelectField
              label="Primary Goal"
              value={form.primaryGoal}
              onChange={(v) => update("primaryGoal", v)}
              options={[
                { value: "signups", label: "Signups" },
                { value: "leads", label: "Qualified Leads" },
                { value: "demos", label: "Booked Demos" },
                { value: "revenue", label: "Revenue" },
                { value: "awareness", label: "Brand Awareness" },
              ]}
            />
          </div>
        )}

        {currentStep === "brand" && (
          <div className="space-y-5">
            <p className="section-title mb-6">Brand Voice</p>
            <TextAreaField
              label="Brand Voice & Tone"
              value={form.brandVoice}
              onChange={(v) => update("brandVoice", v)}
              placeholder="Describe the brand's voice: professional, casual, bold, technical, friendly..."
              rows={4}
            />
          </div>
        )}

        {currentStep === "budget" && (
          <div className="space-y-5">
            <p className="section-title mb-6">Budget & Targets</p>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Monthly Budget"
                value={form.monthlyBudget}
                onChange={(v) => update("monthlyBudget", v)}
                placeholder="5000"
                type="number"
              />
              <SelectField
                label="Currency"
                value={form.currency}
                onChange={(v) => update("currency", v)}
                options={[
                  { value: "USD", label: "USD" },
                  { value: "EUR", label: "EUR" },
                  { value: "GBP", label: "GBP" },
                ]}
              />
            </div>
            <Field
              label="Target Geographies"
              value={form.targetGeographies}
              onChange={(v) => update("targetGeographies", v)}
              placeholder="US, UK, Canada"
              hint="Comma-separated list"
            />
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Target CAC"
                value={form.targetCac}
                onChange={(v) => update("targetCac", v)}
                placeholder="50"
                type="number"
                hint="Max cost per acquisition"
              />
              <Field
                label="Target ROAS"
                value={form.targetRoas}
                onChange={(v) => update("targetRoas", v)}
                placeholder="3.0"
                type="number"
                hint="Minimum return on ad spend"
              />
            </div>
          </div>
        )}

        {currentStep === "autonomy" && (
          <div className="space-y-5">
            <p className="section-title mb-6">Autonomy Level</p>
            <div className="space-y-3">
              {[
                {
                  value: "draft",
                  title: "Draft",
                  desc: "System proposes everything, publishes nothing",
                },
                {
                  value: "approval",
                  title: "Approval",
                  desc: "System prepares, founder validates before publish",
                },
                {
                  value: "guardrailed",
                  title: "Guardrailed Autonomous",
                  desc: "System acts within defined limits (budget, channels, tone)",
                },
                {
                  value: "autonomous",
                  title: "Full Autonomous",
                  desc: "System operates entirely on its own",
                },
              ].map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => update("autonomyMode", mode.value)}
                  className={`block w-full border p-4 text-left transition-all ${
                    form.autonomyMode === mode.value
                      ? "border-accent/30 bg-accent/10"
                      : "border-divider bg-transparent hover:border-divider"
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${
                      form.autonomyMode === mode.value
                        ? "text-accent"
                        : "text-text"
                    }`}
                  >
                    {mode.title}
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">{mode.desc}</p>
                </button>
              ))}
            </div>

            {/* Share Connections */}
            {existingConnections.length > 0 && (
              <div className="mt-6">
                <p className="section-title mb-4">Share Connections</p>
                <button
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      shareConnections: !prev.shareConnections,
                    }))
                  }
                  className={`flex w-full items-start gap-3 border p-4 text-left transition-all ${
                    form.shareConnections
                      ? "border-accent/30 bg-accent/10"
                      : "border-divider bg-transparent hover:border-divider"
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border transition-colors ${
                      form.shareConnections
                        ? "border-accent bg-accent"
                        : "border-divider bg-transparent"
                    }`}
                  >
                    {form.shareConnections && (
                      <Check className="h-3 w-3 text-black" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-3.5 w-3.5 text-accent" />
                      <p
                        className={`text-sm font-semibold ${
                          form.shareConnections
                            ? "text-accent"
                            : "text-text"
                        }`}
                      >
                        Share connections from existing workspaces
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      Compatible ad accounts will be shared so you can start
                      launching campaigns immediately. You can switch to
                      workspace-specific accounts later.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {existingConnections.map((conn, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 border border-divider bg-transparent px-2 py-0.5 text-[10px] text-text-secondary"
                        >
                          <span className="font-medium capitalize">
                            {conn.platform}
                          </span>
                          {conn.accountName && (
                            <span className="text-text-secondary">
                              · {conn.accountName}
                            </span>
                          )}
                          <span className="text-text-secondary">
                            from {conn.workspaceName}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(steps[stepIndex - 1].key)}
            disabled={isFirst}
            className="btn-secondary px-4 py-2 text-xs disabled:opacity-30"
          >
            <ArrowLeft className="mr-2 h-3 w-3" />
            Back
          </button>

          {isLast ? (
            <button
              onClick={handleSubmit}
              disabled={submitting || !form.name || !form.productName || !form.productDescription}
              className="btn-primary px-6 py-2 text-xs disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Workspace"}
            </button>
          ) : (
            <button
              onClick={() => setCurrentStep(steps[stepIndex + 1].key)}
              className="btn-primary px-4 py-2 text-xs"
            >
              Next
              <ArrowRight className="ml-2 h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-text-secondary">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input w-full"
      />
      {hint && (
        <p className="mt-1 text-[10px] text-text-secondary">{hint}</p>
      )}
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-text-secondary">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="input w-full resize-none"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-text-secondary">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input w-full"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
