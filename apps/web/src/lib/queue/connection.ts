/**
 * Redis connection options for BullMQ.
 * Uses connection options object (not an ioredis instance) to avoid version mismatch.
 */

export interface RedisConnectionOptions {
  host: string;
  port: number;
  maxRetriesPerRequest: null;
}

function parseRedisUrl(url: string): { host: string; port: number } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: parseInt(parsed.port, 10) || 6379,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
}

export function getRedisConnectionOptions(): RedisConnectionOptions {
  const { host, port } = parseRedisUrl(
    process.env.REDIS_URL ?? "redis://localhost:6379"
  );
  return {
    host,
    port,
    maxRetriesPerRequest: null, // Required by BullMQ
  };
}
