"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  Zap,
  Bell,
  AlertTriangle,
  Activity,
  Loader2,
  ChevronDown,
} from "lucide-react";

interface ActivityFeedProps {
  workspaceId: string;
  campaignId?: string;
  limit?: number;
}

interface EventData {
  title?: string;
  agentType?: string;
  category?: string;
  [key: string]: unknown;
}

interface FeedEvent {
  id: string;
  type: string;
  data: EventData | string | null;
  createdAt: string;
  campaignId?: string | null;
}

const EVENT_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: typeof Activity }
> = {
  task_created: {
    label: "Task Created",
    color: "#3b82f6",
    bgColor: "rgba(59, 130, 246, 0.15)",
    icon: ClipboardList,
  },
  task_completed: {
    label: "Task Completed",
    color: "#22c55e",
    bgColor: "rgba(34, 197, 94, 0.15)",
    icon: CheckCircle2,
  },
  task_failed: {
    label: "Task Failed",
    color: "#ef4444",
    bgColor: "rgba(239, 68, 68, 0.15)",
    icon: AlertCircle,
  },
  agent_action_taken: {
    label: "Agent Action",
    color: "#6366F1",
    bgColor: "rgba(200, 255, 0, 0.15)",
    icon: Zap,
  },
  approval_requested: {
    label: "Approval Requested",
    color: "#f59e0b",
    bgColor: "rgba(245, 158, 11, 0.15)",
    icon: Bell,
  },
  anomaly_detected: {
    label: "Anomaly Detected",
    color: "#ef4444",
    bgColor: "rgba(239, 68, 68, 0.15)",
    icon: AlertTriangle,
  },
};

const DEFAULT_CONFIG = {
  label: "Event",
  color: "#6b7280",
  bgColor: "rgba(107, 114, 128, 0.15)",
  icon: Activity,
};

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function parseEventData(data: EventData | string | null): EventData {
  if (!data) return {};
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  return data;
}

function summarizeEvent(data: EventData): string {
  const parts: string[] = [];
  if (data.title) parts.push(String(data.title));
  if (data.agentType) parts.push(`agent: ${data.agentType}`);
  if (data.category) parts.push(`category: ${data.category}`);
  if (parts.length === 0) return "";
  return parts.join(" — ");
}

export function ActivityFeed({
  workspaceId,
  campaignId,
  limit = 20,
}: ActivityFeedProps) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const fetchEvents = useCallback(
    async (offset: number, append: boolean) => {
      const setLoader = offset === 0 ? setLoading : setLoadingMore;
      setLoader(true);
      try {
        const fetchLimit = limit + 1; // fetch one extra to detect "has more"
        const res = await fetch(
          `/api/workspaces/${workspaceId}/events?limit=${fetchLimit + offset}`
        );
        if (!res.ok) return;
        const allEvents: FeedEvent[] = await res.json();

        // Filter by campaignId if provided
        let filtered = campaignId
          ? allEvents.filter((e) => e.campaignId === campaignId)
          : allEvents;

        // Slice to the correct window
        const sliced = filtered.slice(offset, offset + fetchLimit);
        setHasMore(sliced.length > limit);
        const pageEvents = sliced.slice(0, limit);

        if (append) {
          setEvents((prev) => [...prev, ...pageEvents]);
        } else {
          setEvents(pageEvents);
        }
      } catch {
        // ignore
      } finally {
        setLoader(false);
      }
    },
    [workspaceId, campaignId, limit]
  );

  // Initial fetch
  useEffect(() => {
    setPage(0);
    setEvents([]);
    setHasMore(true);
    fetchEvents(0, false);
  }, [fetchEvents]);

  // Auto-refresh every 30 seconds (only refreshes the current view)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchEvents(0, false);
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchEvents(nextPage * limit, true);
  };

  if (loading) {
    return (
      <div
        className="card"
        style={{
          padding: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          color: "#6b7280",
        }}
      >
        <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontFamily: "monospace", fontSize: "13px" }}>
          Loading activity feed...
        </span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div
        className="card"
        style={{
          padding: "40px 24px",
          textAlign: "center",
        }}
      >
        <Activity
          size={32}
          style={{ color: "#374151", margin: "0 auto 16px" }}
        />
        <p
          style={{
            color: "#6b7280",
            fontSize: "14px",
            lineHeight: "1.6",
            maxWidth: "400px",
            margin: "0 auto",
          }}
        >
          No activity yet — the autonomous loop will start creating events once
          campaigns are live.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          className="eyebrow"
          style={{ margin: 0, fontSize: "11px", letterSpacing: "0.08em" }}
        >
          Activity Feed
        </span>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "11px",
            color: "#6b7280",
          }}
        >
          {events.length} events
        </span>
      </div>

      <div style={{ padding: "8px 0" }}>
        {events.map((event, idx) => {
          const config = EVENT_CONFIG[event.type] ?? DEFAULT_CONFIG;
          const Icon = config.icon;
          const data = parseEventData(event.data);
          const summary = summarizeEvent(data);
          const isLast = idx === events.length - 1;

          return (
            <div
              key={event.id}
              style={{
                display: "flex",
                gap: "14px",
                padding: "12px 20px",
                position: "relative",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.02)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              {/* Timeline line */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flexShrink: 0,
                  width: "32px",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: config.bgColor,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={15} style={{ color: config.color }} />
                </div>
                {!isLast && (
                  <div
                    style={{
                      width: "1px",
                      flex: 1,
                      minHeight: "12px",
                      background: "rgba(255, 255, 255, 0.06)",
                      marginTop: "4px",
                    }}
                  />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0, paddingTop: "4px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    className="badge"
                    style={{
                      color: config.color,
                      background: config.bgColor,
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "2px 8px",
                      fontFamily: "monospace",
                    }}
                  >
                    {config.label}
                  </span>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "11px",
                      color: "#4b5563",
                    }}
                  >
                    {getRelativeTime(event.createdAt)}
                  </span>
                </div>
                {summary && (
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: "13px",
                      color: "#d1d5db",
                      lineHeight: "1.5",
                      fontFamily: "monospace",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {summary}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div
          style={{
            padding: "12px 20px 16px",
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 20px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              color: "#9ca3af",
              fontFamily: "monospace",
              fontSize: "12px",
              cursor: loadingMore ? "wait" : "pointer",
              transition: "all 0.15s",
              borderRadius: 0,
            }}
            onMouseEnter={(e) => {
              if (!loadingMore) {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                e.currentTarget.style.color = "#6366F1";
                e.currentTarget.style.borderColor = "rgba(99,102,241,0.2)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.color = "#9ca3af";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
            }}
          >
            {loadingMore ? (
              <>
                <Loader2
                  size={13}
                  style={{ animation: "spin 1s linear infinite" }}
                />
                Loading...
              </>
            ) : (
              <>
                <ChevronDown size={13} />
                Load more
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
