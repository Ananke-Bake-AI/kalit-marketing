import { Worker, type Job } from "bullmq";
import { getRedisConnectionOptions } from "../connection";
import { handleEvent, type EventPayload } from "../../engine/event-handler";

export function createEventWorker(): Worker {
  const worker = new Worker<EventPayload>(
    "events",
    async (job: Job<EventPayload>) => {
      console.log(`[event-worker] processing event=${job.data.type} workspace=${job.data.workspaceId}`);
      const result = await handleEvent(job.data);
      console.log(`[event-worker] handled=${result.handled} actions=[${result.actions.join(", ")}]`);
      return result;
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 5,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[event-worker] failed event=${job?.data.type}`, err.message);
  });

  return worker;
}
