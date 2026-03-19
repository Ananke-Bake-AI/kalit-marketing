"use client";

import { useState, useRef } from "react";
import { Globe, Upload, Loader2, Check, FileText } from "lucide-react";

interface ContextAnalyzerProps {
  workspaceId: string;
}

export function ContextAnalyzer({ workspaceId }: ContextAnalyzerProps) {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = async (type: "website" | "file", body: Record<string, unknown>) => {
    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ...body }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");

      const count = data.memoriesCreated ?? 0;
      setResult(`Extracted ${count} insight${count !== 1 ? "s" : ""} and saved to workspace memory.`);
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await handleAnalyze("file", { content: text.slice(0, 10000), fileName: file.name });
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-100">Import Context</h3>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-startup.com"
          className="flex-1 border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-accent/30 focus:outline-none"
          disabled={analyzing}
        />
        <button
          onClick={() => handleAnalyze("website", { url })}
          disabled={analyzing || !url.trim()}
          className="btn-primary px-4 py-2 text-xs disabled:opacity-50"
        >
          {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Analyze"}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.pdf,.doc,.docx,.csv"
          onChange={handleFileUpload}
          className="hidden"
          disabled={analyzing}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={analyzing}
          className="flex items-center gap-1.5 border border-dashed border-white/10 px-3 py-1.5 text-[10px] text-slate-500 hover:border-white/20 hover:text-white transition-all disabled:opacity-50"
        >
          <Upload className="h-3 w-3" />
          Upload file
        </button>
        <span className="text-[10px] text-slate-600">.txt, .md, .pdf, .csv</span>
      </div>

      {result && (
        <div className="mt-3 flex items-center gap-2 border border-emerald-500/20 bg-emerald-500/5 p-2.5">
          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <p className="text-[11px] text-emerald-400">{result}</p>
        </div>
      )}

      {error && (
        <div className="mt-3 border border-red-500/30 bg-red-500/10 p-2.5">
          <p className="text-[11px] text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
