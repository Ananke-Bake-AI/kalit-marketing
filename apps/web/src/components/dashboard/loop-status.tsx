"use client";

import { useState } from "react";
import {
  Play,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Info,
  Zap,
} from "lucide-react";

interface LoopStatusProps {
  workspaceId: string;
}

interface TickResult {
  ok: boolean;
  timestamp: string;
  phase0_scheduler: { tasksCreated: number; workspacesChecked: number };
  phase1_sync: { workspaces: number; campaignsUpdated: number; errors: string[] };
  phase2_tasks: { processed: number; succeeded: number; failed: number; errors: string[] };
  phase3_actions: { applied: number; recommendations: number; errors: string[] };
  durationMs: number;
}

const PHASES = [
  "Scheduling tasks...",
  "Syncing performance data...",
  "Running AI agents...",
  "Applying actions...",
] as const;

export function LoopStatus({ workspaceId }: LoopStatusProps) {
  const [running, setRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [result, setResult] = useState<TickResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const allErrors = result
    ? [
        ...result.phase1_sync.errors,
        ...result.phase2_tasks.errors,
        ...result.phase3_actions.errors,
      ]
    : [];

  const runTick = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    setErrorsExpanded(false);
    setCurrentPhase(0);

    // Simulate phase progression while waiting for the response
    const phaseInterval = setInterval(() => {
      setCurrentPhase((prev) => (prev < 3 ? prev + 1 : prev));
    }, 2000);

    try {
      const res = await fetch("/api/internal/worker/tick");
      clearInterval(phaseInterval);

      if (!res.ok) {
        throw new Error(`Tick failed with status ${res.status}`);
      }

      const data: TickResult = await res.json();
      setResult(data);
      setLastRun(data.timestamp);
      setCurrentPhase(3);
    } catch (err) {
      clearInterval(phaseInterval);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTimestamp = (ts: string): string => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  return (
    <div
      className="card"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        padding: "24px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Zap size={18} style={{ color: "#6366F1" }} />
          <span className="eyebrow" style={{ color: "#6366F1", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>
            Optimization Loop
          </span>
        </div>
        {lastRun && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "rgba(255,255,255,0.4)", fontSize: "12px", fontFamily: "monospace" }}>
            <Clock size={12} />
            Last run: {formatTimestamp(lastRun)}
          </div>
        )}
      </div>

      {/* Run Button */}
      <button
        onClick={runTick}
        disabled={running}
        style={{
          width: "100%",
          padding: "12px 20px",
          background: running ? "rgba(99,102,241,0.1)" : "#6366F1",
          color: running ? "#6366F1" : "var(--body)",
          border: running ? "1px solid rgba(99,102,241,0.3)" : "1px solid #6366F1",
          borderRadius: "0",
          cursor: running ? "not-allowed" : "pointer",
          fontWeight: 700,
          fontSize: "14px",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          transition: "all 0.2s",
        }}
      >
        {running ? (
          <>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            Running Optimization Cycle...
          </>
        ) : (
          <>
            <Play size={16} />
            Run Optimization Cycle
          </>
        )}
      </button>

      {/* Phase Indicator */}
      {running && (
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {PHASES.map((label, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 12px",
                background: i === currentPhase ? "rgba(99,102,241,0.06)" : "transparent",
                border: i === currentPhase ? "1px solid rgba(99,102,241,0.15)" : "1px solid transparent",
                transition: "all 0.3s",
              }}
            >
              {i < currentPhase ? (
                <CheckCircle2 size={14} style={{ color: "#6366F1", flexShrink: 0 }} />
              ) : i === currentPhase ? (
                <Loader2 size={14} style={{ color: "#6366F1", animation: "spin 1s linear infinite", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 14, height: 14, border: "1px solid rgba(255,255,255,0.15)", flexShrink: 0 }} />
              )}
              <span
                style={{
                  fontSize: "13px",
                  fontFamily: "monospace",
                  color: i <= currentPhase ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)",
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Result Summary */}
      {result && !running && (
        <div style={{ marginTop: "16px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
            }}
          >
            <ResultStat label="Tasks Created" value={result.phase0_scheduler.tasksCreated} />
            <ResultStat label="Workspaces Synced" value={result.phase1_sync.workspaces} />
            <ResultStat
              label="Tasks Processed"
              value={`${result.phase2_tasks.succeeded}/${result.phase2_tasks.processed}`}
              sub={result.phase2_tasks.failed > 0 ? `${result.phase2_tasks.failed} failed` : undefined}
            />
            <ResultStat label="Actions Applied" value={result.phase3_actions.applied} />
            <ResultStat label="Recommendations" value={result.phase3_actions.recommendations} />
            <ResultStat label="Duration" value={formatDuration(result.durationMs)} />
          </div>

          {/* Errors Section */}
          {allErrors.length > 0 && (
            <div style={{ marginTop: "12px" }}>
              <button
                onClick={() => setErrorsExpanded(!errorsExpanded)}
                style={{
                  background: "rgba(255,100,100,0.08)",
                  border: "1px solid rgba(255,100,100,0.2)",
                  borderRadius: "0",
                  padding: "8px 12px",
                  width: "100%",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#ff6b6b",
                  fontSize: "12px",
                  fontFamily: "monospace",
                }}
              >
                {errorsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <AlertTriangle size={14} />
                {allErrors.length} error{allErrors.length !== 1 ? "s" : ""} during tick
              </button>
              {errorsExpanded && (
                <div
                  style={{
                    marginTop: "4px",
                    padding: "12px",
                    background: "rgba(255,100,100,0.04)",
                    border: "1px solid rgba(255,100,100,0.1)",
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                >
                  {allErrors.map((err, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: "11px",
                        fontFamily: "monospace",
                        color: "rgba(255,150,150,0.9)",
                        padding: "4px 0",
                        borderBottom: i < allErrors.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      }}
                    >
                      {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error State */}
      {error && !running && (
        <div
          style={{
            marginTop: "16px",
            padding: "12px",
            background: "rgba(255,100,100,0.08)",
            border: "1px solid rgba(255,100,100,0.2)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <AlertTriangle size={16} style={{ color: "#ff6b6b", flexShrink: 0 }} />
          <span style={{ fontSize: "13px", fontFamily: "monospace", color: "#ff6b6b" }}>{error}</span>
        </div>
      )}

      {/* Info Text */}
      <div
        style={{
          marginTop: "16px",
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          color: "rgba(255,255,255,0.35)",
          fontSize: "12px",
          lineHeight: "1.5",
        }}
      >
        <Info size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
        <span>
          The optimization loop runs automatically every hour. You can trigger it manually here.
        </span>
      </div>

      {/* Keyframe animation for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function ResultStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          color: "rgba(255,255,255,0.4)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "18px",
          fontFamily: "monospace",
          fontWeight: 700,
          color: "#6366F1",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "11px", fontFamily: "monospace", color: "#ff6b6b", marginTop: "2px" }}>
          {sub}
        </div>
      )}
    </div>
  );
}
