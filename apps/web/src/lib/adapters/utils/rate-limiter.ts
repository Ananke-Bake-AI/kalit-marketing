/**
 * Token-Bucket Rate Limiter
 *
 * Per-platform rate limiting with configurable bucket sizes and refill rates.
 * Waits (non-busy) when tokens are exhausted, ensuring requests respect API limits.
 */

export interface RateLimitConfig {
  maxTokens: number;
  refillRate: number; // tokens per second
  refillInterval: number; // ms between refill ticks
}

const platformLimits: Record<string, RateLimitConfig> = {
  meta: { maxTokens: 200, refillRate: 200 / 3600, refillInterval: 1000 },
  google: { maxTokens: 1000, refillRate: 1000 / 86400, refillInterval: 1000 },
  tiktok: { maxTokens: 100, refillRate: 100 / 3600, refillInterval: 1000 },
  x: { maxTokens: 300, refillRate: 300 / 900, refillInterval: 1000 },
  linkedin: { maxTokens: 100, refillRate: 100 / 86400, refillInterval: 1000 },
  reddit: { maxTokens: 60, refillRate: 1, refillInterval: 1000 },
};

interface Bucket {
  tokens: number;
  maxTokens: number;
  refillRate: number; // tokens per second
  lastRefill: number; // timestamp ms
  waitQueue: Array<() => void>;
}

export class RateLimiter {
  private buckets: Map<string, Bucket> = new Map();

  private getBucket(platform: string): Bucket {
    let bucket = this.buckets.get(platform);
    if (bucket) return bucket;

    const config = platformLimits[platform] ?? {
      maxTokens: 100,
      refillRate: 100 / 3600,
      refillInterval: 1000,
    };

    bucket = {
      tokens: config.maxTokens,
      maxTokens: config.maxTokens,
      refillRate: config.refillRate,
      lastRefill: Date.now(),
      waitQueue: [],
    };
    this.buckets.set(platform, bucket);
    return bucket;
  }

  private refill(bucket: Bucket): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * bucket.refillRate;
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Acquire a token for the given platform.
   * Resolves immediately if tokens are available, otherwise waits
   * until a token is refilled.
   */
  async acquire(platform: string): Promise<void> {
    const bucket = this.getBucket(platform);
    this.refill(bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return;
    }

    // Wait for a token to become available
    return new Promise<void>((resolve) => {
      bucket.waitQueue.push(resolve);

      // Schedule a check for when a token should be available
      const waitMs = Math.ceil((1 / bucket.refillRate) * 1000);
      const timer = setInterval(() => {
        this.refill(bucket);
        if (bucket.tokens >= 1 && bucket.waitQueue.length > 0) {
          bucket.tokens -= 1;
          const next = bucket.waitQueue.shift();
          if (next) {
            clearInterval(timer);
            next();
          }
        }
      }, Math.min(waitMs, 1000));
    });
  }

  /**
   * Release a token back to the bucket (for retry / cancellation).
   */
  release(platform: string): void {
    const bucket = this.getBucket(platform);
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + 1);

    // Notify next waiter if any
    if (bucket.waitQueue.length > 0 && bucket.tokens >= 1) {
      bucket.tokens -= 1;
      const next = bucket.waitQueue.shift();
      if (next) next();
    }
  }

  /**
   * Get current token count for a platform (useful for monitoring).
   */
  getAvailableTokens(platform: string): number {
    const bucket = this.getBucket(platform);
    this.refill(bucket);
    return Math.floor(bucket.tokens);
  }
}

export const rateLimiter = new RateLimiter();
