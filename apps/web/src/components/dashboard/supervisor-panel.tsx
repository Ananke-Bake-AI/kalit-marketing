"use client";

import { useState, useEffect, useCallback } from "react";
import { Zap, Pause, Play, Settings2, Clock, Loader2, RefreshCw } from "lucide-react";

interface SupervisorPanelProps {
  workspaceId: string;
}

interface SupervisorStatus {
  supervisorEnabled: boolean;
  scheduleMode: string;
  customIntervals: Record<string, number> | null;
  lastSupervisorRun: string | null;
  supervisorStatus: string;
}

export function SupervisorPanel({ workspaceId }: SupervisorPanelProps) {
  const [status, setStatus] = useState<SupervisorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"automatic" | "custom">("automatic");
  const [customInterval, setCustomInterval] = useState(60);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/supervisor`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setScheduleMode(data.scheduleMode as "automatic" | "custom");
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleAction = async (action: "start" | "pause") => {
    setActing(true);
    try {
      const body: Record<string, unknown> = { action };
      if (action === "start") {
        body.mode = scheduleMode;
        if (scheduleMode === "custom") {
          body.intervalMinutes = customInterval;
        }
      }

      const res = await fetch(`/api/workspaces/${workspaceId}/supervisor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await fetchStatus();
      }
    } catch {
      // ignore
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-text-secondary" />
          <h3 className="text-sm font-semibold text-text">Supervisor</h3>
        </div>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-text-secondary" />
        </div>
      </div>
    );
  }

  const isRunning = status?.supervisorEnabled && status?.supervisorStatus === "running";

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className={`h-4 w-4 ${isRunning ? "text-accent" : "text-text-secondary"}`} />
          <h3 className="text-sm font-semibold text-text">Supervisor</h3>
          {isRunning ? (
            <span className="badge bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
              <span className="relative flex h-1.5 w-1.5 mr-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Running
            </span>
          ) : (
            <span className="badge bg-zinc-500/15 text-text-secondary border-zinc-500/30">
              {status?.supervisorStatus === "paused" ? "Paused" : "Idle"}
            </span>
          )}
        </div>
        <button
          onClick={fetchStatus}
          className="text-text-secondary hover:text-text-secondary transition-colors"
          title="Refresh status"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {/* Description */}
      <p className="text-[11px] text-text-secondary leading-relaxed mb-4">
        The Supervisor continuously monitors your workspace — running performance reviews,
        detecting anomalies, checking creative fatigue, and creating optimization tasks
        automatically based on your workspace&apos;s current lifecycle stage.
      </p>

      {/* Mode selector */}
      <div className="mb-4 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-secondary">
          Schedule Mode
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setScheduleMode("automatic")}
            className={`flex-1 border px-3 py-2 text-left transition-all cursor-pointer ${
              scheduleMode === "automatic"
                ? "border-accent/30 bg-accent/10"
                : "border-divider bg-transparent hover:border-divider"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <Zap className={`h-3 w-3 ${scheduleMode === "automatic" ? "text-accent" : "text-text-secondary"}`} />
              <span className={`text-[10px] font-medium ${scheduleMode === "automatic" ? "text-accent" : "text-text-secondary"}`}>
                Automatic
              </span>
            </div>
            <p className="text-[9px] text-text-secondary leading-snug">
              AI adjusts check frequency based on workspace stage
            </p>
          </button>
          <button
            onClick={() => setScheduleMode("custom")}
            className={`flex-1 border px-3 py-2 text-left transition-all cursor-pointer ${
              scheduleMode === "custom"
                ? "border-accent/30 bg-accent/10"
                : "border-divider bg-transparent hover:border-divider"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <Settings2 className={`h-3 w-3 ${scheduleMode === "custom" ? "text-accent" : "text-text-secondary"}`} />
              <span className={`text-[10px] font-medium ${scheduleMode === "custom" ? "text-accent" : "text-text-secondary"}`}>
                Custom
              </span>
            </div>
            <p className="text-[9px] text-text-secondary leading-snug">
              Fixed interval you control
            </p>
          </button>
        </div>

        {scheduleMode === "custom" && (
          <div className="flex items-center gap-2 mt-2">
            <Clock className="h-3 w-3 text-text-secondary" />
            <span className="text-[10px] text-text-secondary">Every</span>
            <select
              value={customInterval}
              onChange={(e) => setCustomInterval(Number(e.target.value))}
              className="border border-divider bg-white/[0.05] px-2 py-1 text-[10px] text-text focus:border-accent/30 focus:outline-none"
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={360}>6 hours</option>
              <option value={720}>12 hours</option>
              <option value={1440}>24 hours</option>
            </select>
          </div>
        )}
      </div>

      {/* Last run */}
      {status?.lastSupervisorRun && (
        <div className="mb-4">
          <p className="text-[10px] text-text-secondary">
            Last run:{" "}
            <span className="text-text-secondary">
              {new Date(status.lastSupervisorRun).toLocaleString()}
            </span>
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {isRunning ? (
          <button
            onClick={() => handleAction("pause")}
            disabled={acting}
            className="flex items-center gap-1.5 border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-400 transition-all hover:bg-red-500/20 disabled:opacity-50"
          >
            {acting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Pause className="h-3 w-3" />
            )}
            Pause
          </button>
        ) : (
          <button
            onClick={() => handleAction("start")}
            disabled={acting}
            className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-50"
          >
            {acting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            Start Supervisor
          </button>
        )}
      </div>
    </div>
  );
}
