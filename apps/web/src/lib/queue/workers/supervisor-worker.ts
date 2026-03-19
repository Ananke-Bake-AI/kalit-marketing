import { Worker, type Job } from "bullmq";
import { prisma } from "@kalit/db";
import { getRedisConnectionOptions } from "../connection";
import { getTaskQueue } from "../queues";
import { scheduledJobs, type ScheduleDefinition } from "../../engine/scheduler";

export interface SupervisorJobData {
  workspaceId: string;
  mode: "tick"; // single supervisor tick
}

/**
 * Automatic mode intervals — the supervisor decides what to run and when
 * based on workspace state.
 */
const AUTO_INTERVALS: Record<string, number> = {
  // State → supervisor tick interval in minutes
  auditing: 30,
  strategy_ready: 60,
  producing: 30,
  launching: 15,
  monitoring: 15,
  optimizing: 10,
  scaling: 10,
  anomaly_detected: 5,
};

/**
 * Determine which scheduled jobs are due for a workspace.
 */
async function getDueJobs(
  workspaceId: string,
  workspaceStatus: string,
  customIntervals?: Record<string, number> | null
): Promise<ScheduleDefinition[]> {
  const dueJobs: ScheduleDefinition[] = [];

  for (const job of scheduledJobs) {
    if (!job.activeStates.includes(workspaceStatus)) continue;

    // Use custom interval if provided, otherwise default
    const intervalHours = customIntervals?.[job.agentType] ?? job.intervalHours;

    const lastRun = await prisma.task.findFirst({
      where: {
        workspaceId,
        agentType: job.agentType,
        trigger: "scheduled",
        title: job.name,
        createdAt: {
          gte: new Date(Date.now() - intervalHours * 60 * 60 * 1000),
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!lastRun) {
      dueJobs.push({ ...job, intervalHours });
    }
  }

  return dueJobs;
}

/**
 * Process a single supervisor tick for one workspace.
 */
async function processSupervisorTick(workspaceId: string): Promise<{
  tasksQueued: number;
  jobNames: string[];
}> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { config: true },
  });

  if (!workspace || workspace.status === "paused" || workspace.status === "onboarding") {
    return { tasksQueued: 0, jobNames: [] };
  }

  const config = workspace.config;
  const customIntervals = config?.customIntervals as Record<string, number> | null;

  // Get due scheduled jobs
  const dueJobs = await getDueJobs(workspaceId, workspace.status, customIntervals);

  const taskQueue = getTaskQueue();
  const jobNames: string[] = [];

  for (const job of dueJobs) {
    // Create task in DB
    const task = await prisma.task.create({
      data: {
        workspaceId,
        title: job.name,
        description: job.description,
        family: job.family,
        agentType: job.agentType,
        priority: job.priority,
        trigger: "scheduled",
        status: "queued",
        reason: `Supervisor scheduled (every ${job.intervalHours}h)`,
      },
    });

    // Queue for processing
    await taskQueue.add("process-task", {
      taskId: task.id,
      workspaceId,
      agentType: job.agentType,
      priority: job.priority,
    }, {
      priority: job.priority === "critical" ? 1 : job.priority === "high" ? 2 : job.priority === "medium" ? 3 : 4,
    });

    await prisma.event.create({
      data: {
        workspaceId,
        type: "task_created",
        data: {
          taskId: task.id,
          title: job.name,
          family: job.family,
          agentType: job.agentType,
          trigger: "supervisor",
          intervalHours: job.intervalHours,
        },
      },
    });

    jobNames.push(job.name);
  }

  // Update last supervisor run
  if (config) {
    await prisma.workspaceConfig.update({
      where: { workspaceId },
      data: { lastSupervisorRun: new Date() },
    });
  }

  return { tasksQueued: dueJobs.length, jobNames };
}

/**
 * Create and start the supervisor worker.
 */
export function createSupervisorWorker(): Worker {
  const worker = new Worker<SupervisorJobData>(
    "supervisor",
    async (job: Job<SupervisorJobData>) => {
      const { workspaceId } = job.data;
      const result = await processSupervisorTick(workspaceId);

      if (result.tasksQueued > 0) {
        console.log(
          `[supervisor] workspace=${workspaceId} queued=${result.tasksQueued} jobs=[${result.jobNames.join(", ")}]`
        );
      }

      return result;
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 5,
      limiter: {
        max: 20,
        duration: 60_000, // max 20 ticks per minute across all workspaces
      },
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[supervisor] failed workspace=${job?.data.workspaceId}`, err.message);
  });

  return worker;
}

/**
 * Register a workspace for supervisor ticks.
 * In automatic mode, the interval is based on workspace state.
 * In custom mode, the user specifies the interval.
 */
export async function registerWorkspaceSupervisor(
  workspaceId: string,
  mode: "automatic" | "custom",
  customIntervalMinutes?: number
): Promise<void> {
  const queue = (await import("../queues")).getSupervisorQueue();

  // Remove any existing repeatable job for this workspace
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const rj of repeatableJobs) {
    if (rj.id === workspaceId) {
      await queue.removeRepeatableByKey(rj.key);
    }
  }

  // Determine interval
  let intervalMs: number;

  if (mode === "custom" && customIntervalMinutes) {
    intervalMs = customIntervalMinutes * 60 * 1000;
  } else {
    // Automatic: fetch current workspace state to determine interval
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { status: true },
    });
    const autoInterval = AUTO_INTERVALS[workspace?.status ?? "monitoring"] ?? 30;
    intervalMs = autoInterval * 60 * 1000;
  }

  // Add repeatable job
  await queue.add(
    "supervisor-tick",
    { workspaceId, mode: "tick" },
    {
      repeat: { every: intervalMs },
      jobId: workspaceId,
    }
  );

  // Update config
  await prisma.workspaceConfig.update({
    where: { workspaceId },
    data: {
      supervisorEnabled: true,
      scheduleMode: mode,
      supervisorStatus: "running",
    },
  });
}

/**
 * Pause supervisor for a workspace.
 */
export async function pauseWorkspaceSupervisor(workspaceId: string): Promise<void> {
  const queue = (await import("../queues")).getSupervisorQueue();

  const repeatableJobs = await queue.getRepeatableJobs();
  for (const rj of repeatableJobs) {
    if (rj.id === workspaceId) {
      await queue.removeRepeatableByKey(rj.key);
    }
  }

  await prisma.workspaceConfig.update({
    where: { workspaceId },
    data: {
      supervisorEnabled: false,
      supervisorStatus: "paused",
    },
  });
}

/**
 * Update supervisor interval when workspace state changes.
 */
export async function updateSupervisorInterval(workspaceId: string): Promise<void> {
  const config = await prisma.workspaceConfig.findUnique({
    where: { workspaceId },
    select: { supervisorEnabled: true, scheduleMode: true, customIntervals: true },
  });

  if (!config?.supervisorEnabled) return;

  if (config.scheduleMode === "automatic") {
    await registerWorkspaceSupervisor(workspaceId, "automatic");
  }
  // Custom mode keeps its fixed interval
}
