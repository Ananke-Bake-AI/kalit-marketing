"use client";

import { useState } from "react";
import {
  Pencil,
  Save,
  X,
  Loader2,
  Check,
} from "lucide-react";

interface WorkspaceEditProps {
  workspaceId: string;
  initialValues: {
    name: string;
    productName?: string;
    productDescription?: string;
    productUrl?: string | null;
    industry?: string | null;
    stage?: string | null;
    icpDescription?: string | null;
    brandVoice?: string | null;
    monthlyBudget?: number | null;
    targetCac?: number | null;
    targetRoas?: number | null;
    currency?: string;
    autonomyMode?: string;
    primaryGoal?: string | null;
  };
}

export function WorkspaceEdit({ workspaceId, initialValues }: WorkspaceEditProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState(initialValues);

  function handleChange(key: string, value: string | number | null) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => {
          setOpen(false);
          setSaved(false);
          window.location.reload();
        }, 800);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-text-secondary border border-divider hover:border-divider hover:text-text transition-colors cursor-pointer"
      >
        <Pencil className="h-3 w-3" />
        Edit Workspace
      </button>
    );
  }

  return (
    <div className="card p-5 space-y-4 border-accent/20">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-text">Edit Workspace</h3>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-600">
              <Check className="h-3 w-3" />
              Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors disabled:opacity-30 cursor-pointer"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save
          </button>
          <button
            onClick={() => { setOpen(false); setValues(initialValues); }}
            className="text-text-secondary hover:text-text transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Workspace Name" value={values.name} onChange={(v) => handleChange("name", v)} />
        <Field label="Product Name" value={values.productName ?? ""} onChange={(v) => handleChange("productName", v)} />
        <Field label="Product URL" value={values.productUrl ?? ""} onChange={(v) => handleChange("productUrl", v)} placeholder="https://..." />
        <Field label="Industry" value={values.industry ?? ""} onChange={(v) => handleChange("industry", v)} />
        <Field label="Stage" value={values.stage ?? ""} onChange={(v) => handleChange("stage", v)} placeholder="seed, growth, scale..." />
        <Field label="Currency" value={values.currency ?? "USD"} onChange={(v) => handleChange("currency", v)} />
        <Field
          label="Monthly Budget"
          value={values.monthlyBudget?.toString() ?? ""}
          onChange={(v) => handleChange("monthlyBudget", v ? Number(v) : null)}
          type="number"
        />
        <Field
          label="Target CAC"
          value={values.targetCac?.toString() ?? ""}
          onChange={(v) => handleChange("targetCac", v ? Number(v) : null)}
          type="number"
        />
        <Field
          label="Target ROAS"
          value={values.targetRoas?.toString() ?? ""}
          onChange={(v) => handleChange("targetRoas", v ? Number(v) : null)}
          type="number"
          placeholder="e.g. 3.5"
        />
        <Field label="Primary Goal" value={values.primaryGoal ?? ""} onChange={(v) => handleChange("primaryGoal", v)} />
      </div>

      <Field
        label="Product Description"
        value={values.productDescription ?? ""}
        onChange={(v) => handleChange("productDescription", v)}
        multiline
      />
      <Field
        label="Ideal Customer Profile"
        value={values.icpDescription ?? ""}
        onChange={(v) => handleChange("icpDescription", v)}
        multiline
      />
      <Field
        label="Brand Voice"
        value={values.brandVoice ?? ""}
        onChange={(v) => handleChange("brandVoice", v)}
        multiline
        placeholder="Describe your brand's tone and voice..."
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
}) {
  const inputClass =
    "w-full bg-transparent border border-divider text-xs px-3 py-2 text-text placeholder-slate-700 focus:outline-none focus:border-accent/30 transition-colors";

  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-secondary mb-1 block">
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`${inputClass} resize-none`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
    </div>
  );
}
