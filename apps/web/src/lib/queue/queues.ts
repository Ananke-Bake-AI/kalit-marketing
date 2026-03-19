import { Queue } from "bullmq";
import { getRedisConnectionOptions } from "./connection";

// Lazy queue singletons
let _supervisorQueue: Queue | null = null;
let _taskQueue: Queue | null = null;
let _eventQueue: Queue | null = null;
let _analyzerQueue: Queue | null = null;

export function getSupervisorQueue(): Queue {
  if (!_supervisorQueue) {
    _supervisorQueue = new Queue("supervisor", {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return _supervisorQueue;
}

export function getTaskQueue(): Queue {
  if (!_taskQueue) {
    _taskQueue = new Queue("tasks", {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    });
  }
  return _taskQueue;
}

export function getEventQueue(): Queue {
  if (!_eventQueue) {
    _eventQueue = new Queue("events", {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 100 },
      },
    });
  }
  return _eventQueue;
}

export function getAnalyzerQueue(): Queue {
  if (!_analyzerQueue) {
    _analyzerQueue = new Queue("analyzer", {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 20 },
        attempts: 2,
        backoff: { type: "exponential", delay: 10000 },
      },
    });
  }
  return _analyzerQueue;
}
