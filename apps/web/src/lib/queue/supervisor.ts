import { createSupervisorWorker } from "./workers/supervisor-worker";
import { createTaskWorker } from "./workers/task-worker";
import { createEventWorker } from "./workers/event-worker";
import { createAnalyzerWorker } from "./workers/analyzer-worker";
import type { Worker } from "bullmq";

let workers: Worker[] = [];
let started = false;

/**
 * Start all queue workers. Safe to call multiple times — only starts once.
 */
export async function startSupervisor(): Promise<void> {
  if (started) return;
  started = true;

  console.log("[supervisor] Starting growth supervisor...");

  const supervisorWorker = createSupervisorWorker();
  const taskWorker = createTaskWorker();
  const eventWorker = createEventWorker();
  const analyzerWorker = createAnalyzerWorker();

  workers = [supervisorWorker, taskWorker, eventWorker, analyzerWorker];

  // Register all active workspaces that have supervisor enabled
  const { prisma } = await import("@kalit/db");
  const activeConfigs = await prisma.workspaceConfig.findMany({
    where: { supervisorEnabled: true },
    select: { workspaceId: true, scheduleMode: true },
  });

  const { registerWorkspaceSupervisor } = await import("./workers/supervisor-worker");

  for (const config of activeConfigs) {
    await registerWorkspaceSupervisor(
      config.workspaceId,
      config.scheduleMode as "automatic" | "custom"
    );
  }

  console.log(
    `[supervisor] Started with ${activeConfigs.length} active workspace(s)`
  );
}

/**
 * Gracefully shut down all workers.
 */
export async function stopSupervisor(): Promise<void> {
  if (!started) return;

  console.log("[supervisor] Shutting down...");

  await Promise.all(workers.map((w) => w.close()));
  workers = [];
  started = false;

  console.log("[supervisor] Shutdown complete");
}

/**
 * Check if the supervisor is running.
 */
export function isSupervisorRunning(): boolean {
  return started;
}
