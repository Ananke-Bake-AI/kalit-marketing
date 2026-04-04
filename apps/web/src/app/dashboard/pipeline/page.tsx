"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  FlaskConical,
  Paintbrush,
  Rocket,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Play,
  RotateCcw,
  Square,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface Task {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  family: string;
  agentType: string;
  status: string;
  priority: string;
  trigger: string;
  reason: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface Workspace {
  id: string;
  name: string;
}

const familyConfig: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; border: string }
> = {
  research: {
    icon: Search,
    color: "text-blue-400",
    bg: "bg-blue-500/15",
    border: "border-blue-500/30",
  },
  production: {
    icon: Paintbrush,
    color: "text-purple-400",
    bg: "bg-purple-500/15",
    border: "border-purple-500/30",
  },
  execution: {
    icon: Rocket,
    color: "text-emerald-600",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
  },
  review: {
    icon: Eye,
    color: "text-amber-400",
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
  },
};

const statusConfig: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; label: string; spinning?: boolean }
> = {
  queued: { icon: Clock, color: "text-text-secondary", bg: "bg-zinc-500/20", label: "Queued" },
  researching: { icon: Loader2, color: "text-blue-400", bg: "bg-blue-500/20", label: "Researching", spinning: true },
  generating: { icon: Loader2, color: "text-purple-400", bg: "bg-purple-500/20", label: "Generating", spinning: true },
  executing: { icon: Loader2, color: "text-emerald-600", bg: "bg-emerald-500/20", label: "Executing", spinning: true },
  waiting_approval: {
    icon: AlertTriangle,
    color: "text-orange-400",
    bg: "bg-orange-500/20",
    label: "Awaiting Approval",
  },
  approved: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-500/20", label: "Approved" },
  completed: {
    icon: CheckCircle,
    color: "text-emerald-600",
    bg: "bg-emerald-500/20",
    label: "Completed",
  },
  failed: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/20", label: "Failed" },
};

const priorityColors: Record<string, string> = {
  critical: "text-red-400 border-red-500/30 bg-red-500/15",
  high: "text-orange-400 border-orange-500/30 bg-orange-500/15",
  medium: "text-amber-400 border-amber-500/30 bg-amber-500/15",
  low: "text-text-secondary border-divider bg-subtle",
};

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

export default function PipelinePage() {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [filterFamily, setFilterFamily] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const wsRes = await fetch("/api/workspaces");
      const wsData: Workspace[] = await wsRes.json();
      setWorkspaces(wsData);

      // Fetch tasks from all workspaces
      const taskPromises = wsData.map((ws) =>
        fetch(`/api/workspaces/${ws.id}/tasks`).then((r) => r.json())
      );
      const taskArrays = await Promise.all(taskPromises);
      const merged = taskArrays.flat() as Task[];
      setAllTasks(merged);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 8000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const workspaceNames = new Map(workspaces.map((w) => [w.id, w.name]));

  const filteredTasks = allTasks.filter((t) => {
    if (selectedWorkspace !== "all" && t.workspaceId !== selectedWorkspace) return false;
    if (filterFamily && t.family !== filterFamily) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    return true;
  });

  // Sort: active first
  const sortOrder: Record<string, number> = {
    researching: 0, generating: 0, executing: 0,
    waiting_approval: 1,
    queued: 2, approved: 2,
    completed: 3, failed: 3,
  };
  const sorted = [...filteredTasks].sort((a, b) => {
    const sa = sortOrder[a.status] ?? 5;
    const sb = sortOrder[b.status] ?? 5;
    if (sa !== sb) return sa - sb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const activeCount = allTasks.filter(
    (t) => !["completed", "failed"].includes(t.status)
  ).length;
  const approvalCount = allTasks.filter(
    (t) => t.status === "waiting_approval"
  ).length;

  async function handleAction(workspaceId: string, taskId: string, action: string) {
    setActionLoading(`${taskId}:${action}`);
    try {
      await fetch(`/api/workspaces/${workspaceId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      fetchAll();
    } catch {
      // Silent
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <p className="eyebrow mb-2">Operations</p>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-[-0.04em] text-text">
            Task Pipeline
          </h1>
          {activeCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-accent/20 text-accent font-medium">
              {activeCount} active
            </span>
          )}
          {approvalCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-400 font-medium">
              {approvalCount} pending approval
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-text-secondary">
          All growth tasks across workspaces — research, production, execution,
          review
        </p>
      </div>

      {/* Workspace selector */}
      <div className="mb-4 flex items-center gap-3">
        <select
          value={selectedWorkspace}
          onChange={(e) => setSelectedWorkspace(e.target.value)}
          className="input text-sm w-56"
        >
          <option value="all">All Workspaces</option>
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      {/* Family filter pills */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterFamily(null)}
          className={`badge transition-all cursor-pointer ${
            !filterFamily
              ? "bg-accent/20 text-accent border-accent/30"
              : "bg-subtle text-text-secondary border-divider hover:text-text"
          }`}
        >
          All
        </button>
        {Object.entries(familyConfig).map(([family, config]) => {
          const Icon = config.icon;
          const count = filteredTasks.filter((t) => t.family === family).length;
          return (
            <button
              key={family}
              onClick={() =>
                setFilterFamily(filterFamily === family ? null : family)
              }
              className={`badge gap-1 transition-all cursor-pointer ${
                filterFamily === family
                  ? `${config.bg} ${config.color} ${config.border}`
                  : "bg-subtle text-text-secondary border-divider hover:text-text"
              }`}
            >
              <Icon className="h-2.5 w-2.5" />
              {family}
              <span className="text-text-secondary ml-0.5">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Status filter pills */}
      <div className="mb-6 flex items-center gap-1.5 flex-wrap">
        {Object.entries(statusConfig).map(([status, config]) => {
          const Icon = config.icon;
          const count = filteredTasks.filter((t) => t.status === status).length;
          if (count === 0 && filterStatus !== status) return null;
          return (
            <button
              key={status}
              onClick={() =>
                setFilterStatus(filterStatus === status ? null : status)
              }
              className={`badge gap-1 transition-all cursor-pointer ${
                filterStatus === status
                  ? `${config.bg} ${config.color}`
                  : "bg-subtle text-text-secondary border-divider hover:text-text"
              }`}
            >
              <Icon className={`h-2.5 w-2.5 ${config.spinning ? "animate-spin" : ""}`} />
              {config.label}
              <span className="text-text-secondary ml-0.5">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Tasks list */}
      {loading ? (
        <div className="card-white p-12 text-center">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-text-secondary" />
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-secondary">
            Loading pipeline
          </p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="card-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center border border-divider bg-transparent">
            <FlaskConical className="h-8 w-8 text-text-secondary" />
          </div>
          <h3 className="text-lg font-bold uppercase tracking-[-0.02em] text-text">
            {allTasks.length === 0 ? "Pipeline Empty" : "No matching tasks"}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
            {allTasks.length === 0
              ? "Tasks appear here when the lifecycle engine triggers them — during onboarding, strategy generation, campaign launches, and optimization cycles."
              : "Try adjusting your filters to see tasks."}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((task) => {
            const family = familyConfig[task.family] ?? familyConfig.research;
            const status = statusConfig[task.status] ?? statusConfig.queued;
            const FamilyIcon = family.icon;
            const StatusIcon = status.icon;
            const isActive = ["researching", "generating", "executing"].includes(task.status);
            const isApproval = task.status === "waiting_approval";
            const isFailed = task.status === "failed";
            const isCompleted = task.status === "completed";
            const isExpanded = expandedTask === task.id;

            return (
              <div
                key={task.id}
                className={`border transition-all ${
                  isActive
                    ? "border-accent/20 bg-accent/[0.03]"
                    : isApproval
                      ? "border-orange-500/20 bg-orange-500/[0.03]"
                      : "border-divider bg-transparent"
                }`}
              >
                {/* Main row */}
                <button
                  onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                  className="flex items-center w-full p-3 text-left cursor-pointer"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-text-secondary mr-2.5 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-text-secondary mr-2.5 shrink-0" />
                  )}

                  {/* Family icon */}
                  <span className={`mr-3 shrink-0 ${family.color}`}>
                    <FamilyIcon className="h-3.5 w-3.5" />
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-text truncate">
                        {task.title}
                      </p>
                      <span className={`badge ${priorityColors[task.priority]}`}>
                        {task.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-text-secondary">
                        {task.agentType} · {task.family}
                      </span>
                      {selectedWorkspace === "all" && (
                        <span className="text-[10px] text-text-secondary">
                          · {workspaceNames.get(task.workspaceId) ?? "Unknown"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    {/* Status badge */}
                    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 font-medium ${status.bg} ${status.color}`}>
                      <StatusIcon className={`h-2.5 w-2.5 ${status.spinning ? "animate-spin" : ""}`} />
                      {status.label}
                    </span>

                    {/* Duration / time */}
                    <span className="text-[10px] text-text-secondary w-16 text-right">
                      {task.startedAt && !task.completedAt
                        ? duration(task.startedAt)
                        : timeAgo(task.createdAt)}
                    </span>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-divider">
                    <div className="mt-2 space-y-1.5">
                      {task.description && (
                        <p className="text-[11px] text-text-secondary">{task.description}</p>
                      )}
                      {task.reason && (
                        <p className="text-[10px] text-text-secondary">
                          <span className="text-text-secondary font-medium">Reason:</span> {task.reason}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-[10px] text-text-secondary">
                        <span>Created: {timeAgo(task.createdAt)}</span>
                        {task.startedAt && <span>Started: {timeAgo(task.startedAt)}</span>}
                        {task.completedAt && <span>Finished: {timeAgo(task.completedAt)}</span>}
                        {task.startedAt && (
                          <span className="text-text-secondary font-medium">
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
                            onClick={() => handleAction(task.workspaceId, task.id, "approve")}
                            loading={actionLoading === `${task.id}:approve`}
                            icon={CheckCircle}
                            label="Approve"
                            className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/25"
                          />
                          <ActionBtn
                            onClick={() => handleAction(task.workspaceId, task.id, "reject")}
                            loading={actionLoading === `${task.id}:reject`}
                            icon={XCircle}
                            label="Reject"
                            className="bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25"
                          />
                        </>
                      )}
                      {isActive && (
                        <ActionBtn
                          onClick={() => handleAction(task.workspaceId, task.id, "cancel")}
                          loading={actionLoading === `${task.id}:cancel`}
                          icon={Square}
                          label="Cancel"
                          className="bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25"
                        />
                      )}
                      {(isFailed || isCompleted) && (
                        <ActionBtn
                          onClick={() => handleAction(task.workspaceId, task.id, "restart")}
                          loading={actionLoading === `${task.id}:restart`}
                          icon={RotateCcw}
                          label="Restart"
                          className="bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25"
                        />
                      )}
                      {task.status === "queued" && (
                        <ActionBtn
                          onClick={() => handleAction(task.workspaceId, task.id, "run_now")}
                          loading={actionLoading === `${task.id}:run_now`}
                          icon={Play}
                          label="Run Now"
                          className="bg-accent/15 text-accent border-accent/30 hover:bg-accent/25"
                        />
                      )}
                    </div>
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
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={loading}
      className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium border transition-colors disabled:opacity-50 cursor-pointer ${className}`}
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
