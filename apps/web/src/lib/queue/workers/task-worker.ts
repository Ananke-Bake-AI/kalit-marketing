import { Worker, type Job } from "bullmq";
import { getRedisConnectionOptions } from "../connection";
import { processTask } from "../../engine/agent-router";

export interface TaskJobData {
  taskId: string;
  workspaceId: string;
  agentType: string;
  priority: string;
}

export function createTaskWorker(): Worker {
  const worker = new Worker<TaskJobData>(
    "tasks",
    async (job: Job<TaskJobData>) => {
      const { taskId, workspaceId, agentType } = job.data;

      console.log(`[task-worker] processing task=${taskId} agent=${agentType} workspace=${workspaceId}`);

      const result = await processTask(taskId);

      if (!result.success) {
        throw new Error(result.error ?? "Task processing failed");
      }

      console.log(`[task-worker] completed task=${taskId} agent=${agentType}`);
      return result;
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 3, // Process up to 3 tasks in parallel
      limiter: {
        max: 10,
        duration: 60_000, // max 10 tasks per minute (rate limit API calls)
      },
    }
  );

  worker.on("failed", (job, err) => {
    console.error(
      `[task-worker] failed task=${job?.data.taskId} agent=${job?.data.agentType}`,
      err.message
    );
  });

  worker.on("completed", (job) => {
    console.log(`[task-worker] done task=${job.data.taskId}`);
  });

  return worker;
}
