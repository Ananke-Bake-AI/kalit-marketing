"use client";

import { useState } from "react";
import { usePolling } from "@/hooks/use-polling";
import {
  Clock,
  Activity,
  CheckCircle,
  XCircle,
  Loader2,
  Play,
  RotateCcw,
  Square,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Eye,
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: string;
  family: string;
  agentType: string;
  priority: string;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  reason?: string | null;
}

interface Event {
  id: string;
  type: string;
  data: Record<string, unknown> | null;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function duration(start: string, end?: string | null): string {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const seconds = Math.floor((e - s) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function LiveIndicator() {
  return (
    <span className="ml-auto flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-400">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Live
    </span>
  );
}

const statusConfig: Record<
  string,
  { color: string; bg: string; label: string; spinning?: boolean }
> = {
  queued: { color: "text-slate-400", bg: "bg-zinc-500/20", label: "Queued" },
  researching: { color: "text-blue-400", bg: "bg-blue-500/20", label: "Researching", spinning: true },
  generating: { color: "text-purple-400", bg: "bg-purple-500/20", label: "Generating", spinning: true },
  executing: { color: "text-emerald-400", bg: "bg-emerald-500/20", label: "Executing", spinning: true },
  waiting_approval: { color: "text-orange-400", bg: "bg-orange-500/20", label: "Awaiting Approval" },
  approved: { color: "text-emerald-400", bg: "bg-emerald-500/20", label: "Approved" },
  completed: { color: "text-emerald-400", bg: "bg-emerald-500/20", label: "Completed" },
  failed: { color: "text-red-400", bg: "bg-red-500/20", label: "Failed" },
};

const familyColors: Record<string, string> = {
  research: "text-blue-400",
  production: "text-purple-400",
  execution: "text-emerald-400",
  review: "text-amber-400",
};

const priorityDot: Record<string, string> = {
  critical: "bg-red-400",
  high: "bg-orange-400",
  medium: "bg-amber-400",
  low: "bg-slate-500",
};

export function TaskPipelineLive({
  workspaceId,
  initialTasks,
}: {
  workspaceId: string;
  initialTasks: Task[];
}) {
  const { data: tasks, mutate } = usePolling<Task[]>(
    `/api/workspaces/${workspaceId}/tasks`,
    5000
  );
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");
  const [taskOutputs, setTaskOutputs] = useState<Record<string, Record<string, unknown> | null>>({});
  const [outputLoading, setOutputLoading] = useState<string | null>(null);

  const displayTasks = tasks ?? initialTasks;

  // Sort: active first, then by priority, then by date
  const sortOrder: Record<string, number> = {
    researching: 0, generating: 0, executing: 0,
    waiting_approval: 1,
    queued: 2, approved: 2,
    completed: 3, failed: 3,
  };
  const sorted = [...displayTasks].sort((a, b) => {
    const sa = sortOrder[a.status] ?? 5;
    const sb = sortOrder[b.status] ?? 5;
    if (sa !== sb) return sa - sb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const filtered = sorted.filter((t) => {
    if (filter === "active")
      return !["completed", "failed"].includes(t.status);
    if (filter === "done") return ["completed", "failed"].includes(t.status);
    return true;
  });

  const activeCount = displayTasks.filter(
    (t) => !["completed", "failed"].includes(t.status)
  ).length;

  async function handleAction(taskId: string, action: string) {
    setActionLoading(`${taskId}:${action}`);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      if (res.ok) {
        mutate();
      }
    } catch {
      // Silent
    } finally {
      setActionLoading(null);
    }
  }

  async function fetchTaskOutput(taskId: string) {
    if (taskOutputs[taskId] !== undefined) return; // Already fetched
    setOutputLoading(taskId);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setTaskOutputs((prev) => ({ ...prev, [taskId]: data.output }));
      }
    } catch {
      setTaskOutputs((prev) => ({ ...prev, [taskId]: null }));
    } finally {
      setOutputLoading(null);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-100">Task Pipeline</h3>
        {activeCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 bg-accent/20 text-accent font-medium">
            {activeCount} active
          </span>
        )}
        <LiveIndicator />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-3">
        {(["all", "active", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
              filter === f
                ? "bg-accent/15 text-accent border border-accent/30"
                : "text-slate-600 border border-white/5 hover:text-slate-400"
            }`}
          >
            {f === "all" ? `All (${displayTasks.length})` : f === "active" ? `Active (${activeCount})` : `Done (${displayTasks.length - activeCount})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-700">
            {filter === "all" ? "No tasks yet" : `No ${filter} tasks`}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
          {filtered.map((task) => {
            const cfg = statusConfig[task.status] ?? statusConfig.queued;
            const isActive = ["researching", "generating", "executing"].includes(task.status);
            const isExpanded = expandedTask === task.id;
            const isApproval = task.status === "waiting_approval";
            const isFailed = task.status === "failed";
            const isCompleted = task.status === "completed";

            return (
              <div
                key={task.id}
                className={`border transition-all ${
                  isActive
                    ? "border-accent/20 bg-accent/[0.03]"
                    : isApproval
                      ? "border-orange-500/20 bg-orange-500/[0.03]"
                      : "border-white/5 bg-white/[0.02]"
                }`}
              >
                {/* Main row */}
                <button
                  onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                  className="flex items-center w-full p-2.5 text-left cursor-pointer"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-slate-600 mr-2 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-slate-600 mr-2 shrink-0" />
                  )}

                  {/* Priority dot */}
                  <span
                    className={`h-1.5 w-1.5 rounded-full mr-2 shrink-0 ${priorityDot[task.priority] ?? "bg-slate-500"}`}
                    title={task.priority}
                  />

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {task.title}
                    </p>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      <span className={familyColors[task.family] ?? "text-slate-500"}>
                        {task.agentType}
                      </span>
                      {" · "}
                      {task.family}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    {/* Status badge */}
                    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 font-medium ${cfg.bg} ${cfg.color}`}>
                      {cfg.spinning && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                      {isApproval && <AlertTriangle className="h-2.5 w-2.5" />}
                      {isCompleted && <CheckCircle className="h-2.5 w-2.5" />}
                      {isFailed && <XCircle className="h-2.5 w-2.5" />}
                      {cfg.label}
                    </span>

                    {/* Duration / time */}
                    <span className="text-[10px] text-slate-700 w-12 text-right">
                      {task.startedAt && !task.completedAt
                        ? duration(task.startedAt)
                        : timeAgo(task.createdAt)}
                    </span>
                  </div>
                </button>

                {/* Expanded details + actions */}
                {isExpanded && (
                  <div className="px-2.5 pb-2.5 pt-0 border-t border-white/5">
                    <div className="mt-2 space-y-1.5">
                      {task.reason && (
                        <p className="text-[10px] text-slate-500">
                          <span className="text-slate-600 font-medium">Reason:</span> {task.reason}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-[10px] text-slate-600">
                        <span>Created: {timeAgo(task.createdAt)}</span>
                        {task.startedAt && (
                          <span>Started: {timeAgo(task.startedAt)}</span>
                        )}
                        {task.completedAt && (
                          <span>Finished: {timeAgo(task.completedAt)}</span>
                        )}
                        {task.startedAt && (
                          <span className="text-slate-500">
                            Duration: {duration(task.startedAt, task.completedAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-1.5 mt-3">
                      {isApproval && (
                        <>
                          <ActionBtn
                            onClick={() => handleAction(task.id, "approve")}
                            loading={actionLoading === `${task.id}:approve`}
                            icon={CheckCircle}
                            label="Approve"
                            className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                          />
                          <ActionBtn
                            onClick={() => handleAction(task.id, "reject")}
                            loading={actionLoading === `${task.id}:reject`}
                            icon={XCircle}
                            label="Reject"
                            className="bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25"
                          />
                        </>
                      )}
                      {isActive && (
                        <ActionBtn
                          onClick={() => handleAction(task.id, "cancel")}
                          loading={actionLoading === `${task.id}:cancel`}
                          icon={Square}
                          label="Cancel"
                          className="bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25"
                        />
                      )}
                      {(isFailed || isCompleted) && (
                        <ActionBtn
                          onClick={() => handleAction(task.id, "restart")}
                          loading={actionLoading === `${task.id}:restart`}
                          icon={RotateCcw}
                          label="Restart"
                          className="bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25"
                        />
                      )}
                      {task.status === "queued" && (
                        <ActionBtn
                          onClick={() => handleAction(task.id, "run_now")}
                          loading={actionLoading === `${task.id}:run_now`}
                          icon={Play}
                          label="Run Now"
                          className="bg-accent/15 text-accent border-accent/30 hover:bg-accent/25"
                        />
                      )}
                      {(isCompleted || isApproval || isFailed) && (
                        <ActionBtn
                          onClick={() => fetchTaskOutput(task.id)}
                          loading={outputLoading === task.id}
                          icon={Eye}
                          label="View Output"
                          className="bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
                        />
                      )}
                    </div>

                    {/* Task output viewer */}
                    {taskOutputs[task.id] !== undefined && (
                      <TaskOutputViewer output={taskOutputs[task.id]} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskOutputViewer({ output }: { output: Record<string, unknown> | null }) {
  if (!output) {
    return (
      <div className="mt-3 p-2 border border-white/5 bg-white/[0.02]">
        <p className="text-[10px] text-slate-600">No output data</p>
      </div>
    );
  }

  // Filter out internal fields
  const displayKeys = Object.keys(output).filter((k) => !k.startsWith("_"));

  return (
    <div className="mt-3 space-y-2 max-h-[300px] overflow-y-auto">
      {displayKeys.map((key) => {
        const value = output[key];
        const label = key
          .replace(/([A-Z])/g, " $1")
          .replace(/_/g, " ")
          .trim();

        return (
          <div key={key} className="border border-white/5 bg-white/[0.02]">
            <p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 bg-white/[0.02] border-b border-white/5">
              {label}
            </p>
            <div className="p-2.5">
              {Array.isArray(value) ? (
                <div className="space-y-1.5">
                  {(value as Record<string, unknown>[]).map((item, i) => (
                    <OutputItem key={i} item={item} />
                  ))}
                </div>
              ) : typeof value === "object" && value !== null ? (
                <OutputItem item={value as Record<string, unknown>} />
              ) : (
                <p className="text-[11px] text-slate-300">{String(value)}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OutputItem({ item }: { item: Record<string, unknown> }) {
  if (typeof item !== "object" || item === null) {
    return <p className="text-[11px] text-slate-400">{String(item)}</p>;
  }

  const entries = Object.entries(item);
  // Find the "name" or "title" or "segment" field for the header
  const headerKey = entries.find(
    ([k]) => ["name", "title", "segment", "metric", "channel", "angle"].includes(k)
  );
  const rest = entries.filter(([k]) => k !== headerKey?.[0]);

  return (
    <div className="p-2 bg-white/[0.02] border border-white/5">
      {headerKey && (
        <p className="text-[11px] font-medium text-white mb-1">
          {String(headerKey[1])}
        </p>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
        {rest.map(([k, v]) => (
          <div key={k} className="flex items-baseline gap-1">
            <span className="text-[9px] text-slate-600 uppercase">
              {k.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}:
            </span>
            <span className="text-[10px] text-slate-400">
              {Array.isArray(v)
                ? v.length > 3
                  ? `${v.slice(0, 3).join(", ")} +${v.length - 3} more`
                  : v.join(", ")
                : typeof v === "object" && v !== null
                  ? JSON.stringify(v)
                  : String(v)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionBtn({
  onClick,
  loading,
  icon: Icon,
  label,
  className,
}: {
  onClick: () => void;
  loading: boolean;
  icon: React.ElementType;
  label: string;
  className: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium border transition-colors disabled:opacity-50 cursor-pointer ${className}`}
    >
      {loading ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
      ) : (
        <Icon className="h-2.5 w-2.5" />
      )}
      {label}
    </button>
  );
}

export function EventFeedLive({
  workspaceId,
  initialEvents,
}: {
  workspaceId: string;
  initialEvents: Event[];
}) {
  const { data: events } = usePolling<Event[]>(
    `/api/workspaces/${workspaceId}/events`,
    10000
  );

  const displayEvents = events ?? initialEvents;

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-100">Recent Events</h3>
        <LiveIndicator />
      </div>
      {displayEvents.length === 0 ? (
        <div className="py-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-700">
            No events yet
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {displayEvents.map((event) => (
            <div
              key={event.id}
              className="border-l-2 border-accent/20 pl-3 py-1.5"
            >
              <p className="text-xs text-white">
                {event.type.replace(/_/g, " ")}
              </p>
              {event.data?.reason ? (
                <p className="text-[10px] text-slate-500 italic mt-0.5">
                  {String(event.data.reason)}
                </p>
              ) : null}
              <p className="text-[10px] text-slate-700 mt-0.5">
                {timeAgo(event.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
