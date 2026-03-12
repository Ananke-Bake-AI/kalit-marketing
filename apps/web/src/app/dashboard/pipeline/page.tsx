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
} from "lucide-react";

interface Task {
  id: string;
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
    color: "text-emerald-400",
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
  { icon: React.ElementType; color: string; label: string }
> = {
  queued: { icon: Clock, color: "text-slate-400", label: "Queued" },
  researching: { icon: Loader2, color: "text-blue-400", label: "Researching" },
  generating: { icon: Loader2, color: "text-purple-400", label: "Generating" },
  executing: { icon: Loader2, color: "text-emerald-400", label: "Executing" },
  waiting_approval: {
    icon: AlertTriangle,
    color: "text-orange-400",
    label: "Awaiting Approval",
  },
  approved: { icon: CheckCircle, color: "text-emerald-400", label: "Approved" },
  published: { icon: CheckCircle, color: "text-cyan-400", label: "Published" },
  monitoring: { icon: Eye, color: "text-emerald-400", label: "Monitoring" },
  needs_revision: {
    icon: AlertTriangle,
    color: "text-amber-400",
    label: "Needs Revision",
  },
  completed: {
    icon: CheckCircle,
    color: "text-emerald-400",
    label: "Completed",
  },
  failed: { icon: XCircle, color: "text-red-400", label: "Failed" },
  archived: { icon: Clock, color: "text-slate-600", label: "Archived" },
};

const priorityColors: Record<string, string> = {
  critical: "text-red-400 border-red-500/30 bg-red-500/15",
  high: "text-orange-400 border-orange-500/30 bg-orange-500/15",
  medium: "text-amber-400 border-amber-500/30 bg-amber-500/15",
  low: "text-slate-400 border-white/10 bg-white/5",
};

const triggerLabels: Record<string, string> = {
  request: "Manual",
  event: "Event",
  scheduled: "Scheduled",
};

export default function PipelinePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFamily, setFilterFamily] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    // In a real app, we'd fetch tasks for a specific workspace
    // For now, show a placeholder pipeline view
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filteredTasks = tasks.filter((t) => {
    if (filterFamily && t.family !== filterFamily) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    return true;
  });

  // Group tasks by status for kanban-like view
  const columns = [
    { key: "queued", label: "Queued", statuses: ["queued"] },
    {
      key: "active",
      label: "In Progress",
      statuses: ["researching", "generating", "executing"],
    },
    {
      key: "review",
      label: "Review",
      statuses: ["waiting_approval", "needs_revision"],
    },
    {
      key: "done",
      label: "Done",
      statuses: ["completed", "published", "approved"],
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="eyebrow mb-2">Operations</p>
        <h1 className="text-xl font-bold tracking-[-0.04em] text-white">
          Task Pipeline
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          All growth tasks across workspaces — research, production, execution,
          review
        </p>
      </div>

      {/* Family filter pills */}
      <div className="mb-6 flex items-center gap-2">
        <button
          onClick={() => setFilterFamily(null)}
          className={`badge transition-all ${
            !filterFamily
              ? "bg-accent/20 text-accent border-accent/30"
              : "bg-white/5 text-slate-500 border-white/10 hover:text-slate-300"
          }`}
        >
          All
        </button>
        {Object.entries(familyConfig).map(([family, config]) => {
          const Icon = config.icon;
          return (
            <button
              key={family}
              onClick={() =>
                setFilterFamily(filterFamily === family ? null : family)
              }
              className={`badge gap-1 transition-all ${
                filterFamily === family
                  ? `${config.bg} ${config.color} ${config.border}`
                  : "bg-white/5 text-slate-500 border-white/10 hover:text-slate-300"
              }`}
            >
              <Icon className="h-2.5 w-2.5" />
              {family}
            </button>
          );
        })}
      </div>

      {/* Pipeline columns */}
      {loading ? (
        <div className="panel-surface p-12 text-center">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-slate-500" />
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-600">
            Loading pipeline
          </p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="panel-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center border border-white/10 bg-white/[0.03]">
            <FlaskConical className="h-8 w-8 text-slate-600" />
          </div>
          <h3 className="text-lg font-bold uppercase tracking-[-0.02em] text-gray-200">
            Pipeline Empty
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            Tasks appear here when the lifecycle engine triggers them — during
            onboarding, strategy generation, campaign launches, and optimization
            cycles.
          </p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.24em] text-slate-700">
            Create a workspace to start generating tasks
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {columns.map((col) => {
            const colTasks = filteredTasks.filter((t) =>
              col.statuses.includes(t.status)
            );
            return (
              <div key={col.key}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="eyebrow">{col.label}</p>
                  <span className="font-mono text-[10px] text-slate-600">
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="border border-dashed border-white/10 p-4 text-center">
                      <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-slate-700">
                        No tasks
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Status legend */}
      <div className="mt-8">
        <p className="eyebrow mb-3">Task States</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(statusConfig).map(([status, config]) => {
            const Icon = config.icon;
            return (
              <button
                key={status}
                onClick={() =>
                  setFilterStatus(filterStatus === status ? null : status)
                }
                className={`badge gap-1 transition-all ${
                  filterStatus === status
                    ? "bg-accent/20 text-accent border-accent/30"
                    : "bg-white/5 text-slate-500 border-white/10 hover:text-slate-300"
                }`}
              >
                <Icon className="h-2.5 w-2.5" />
                {config.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const family = familyConfig[task.family] ?? familyConfig.research;
  const status = statusConfig[task.status] ?? statusConfig.queued;
  const FamilyIcon = family.icon;
  const StatusIcon = status.icon;
  const isActive = ["researching", "generating", "executing"].includes(
    task.status
  );

  return (
    <div
      className={`card p-4 hover-lift ${
        isActive ? "border-accent/20" : ""
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className={`badge gap-1 ${family.bg} ${family.color} ${family.border}`}>
          <FamilyIcon className="h-2.5 w-2.5" />
          {task.family}
        </span>
        <span className={`badge ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
      </div>

      <h4 className="text-sm font-semibold text-slate-100">{task.title}</h4>

      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-slate-500">
          {task.description}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <StatusIcon
            className={`h-3 w-3 ${status.color} ${isActive ? "animate-spin" : ""}`}
          />
          <span className={`font-mono text-[10px] ${status.color}`}>
            {status.label}
          </span>
        </div>
        <span className="badge bg-white/5 text-slate-600 border-white/10">
          {triggerLabels[task.trigger] || task.trigger}
        </span>
      </div>

      {task.reason && (
        <p className="mt-2 border-t border-white/5 pt-2 font-mono text-[9px] text-slate-600">
          {task.reason}
        </p>
      )}
    </div>
  );
}
