"use client";

import { usePolling } from "@/hooks/use-polling";
import { Clock, Activity } from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: string;
  family: string;
  agentType: string;
  priority: string;
  createdAt: string;
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

export function TaskPipelineLive({
  workspaceId,
  initialTasks,
}: {
  workspaceId: string;
  initialTasks: Task[];
}) {
  const { data: tasks } = usePolling<Task[]>(
    `/api/workspaces/${workspaceId}/tasks`,
    5000
  );

  const displayTasks = tasks ?? initialTasks;

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-100">Task Pipeline</h3>
        <LiveIndicator />
      </div>
      {displayTasks.length === 0 ? (
        <div className="py-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-700">
            No tasks yet
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {displayTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-2.5 bg-white/[0.02] border border-white/5"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">
                  {task.title}
                </p>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  {task.agentType} · {task.family}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3 shrink-0">
                <span
                  className={`text-[10px] px-1.5 py-0.5 font-medium ${
                    task.status === "completed"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : task.status === "failed"
                        ? "bg-red-500/20 text-red-400"
                        : task.status === "executing" ||
                            task.status === "researching" ||
                            task.status === "generating"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-zinc-500/20 text-zinc-400"
                  }`}
                >
                  {task.status.replace(/_/g, " ")}
                </span>
                <span className="text-[10px] text-slate-700">
                  {timeAgo(task.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
