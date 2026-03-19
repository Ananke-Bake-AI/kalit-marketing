"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export function usePolling<T>(
  url: string,
  intervalMs: number = 5000
): { data: T | null; loading: boolean; error: Error | null; mutate: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isVisibleRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    // Initial fetch
    fetchData();

    // Set up polling interval
    intervalRef.current = setInterval(() => {
      if (isVisibleRef.current) {
        fetchData();
      }
    }, intervalMs);

    // Pause when tab is not visible
    const handleVisibility = () => {
      isVisibleRef.current = document.visibilityState === "visible";
      // Fetch immediately when tab becomes visible again
      if (isVisibleRef.current) {
        fetchData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchData, intervalMs]);

  // Manual refresh trigger
  const mutate = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, mutate };
}
