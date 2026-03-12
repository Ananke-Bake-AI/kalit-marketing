/**
 * Exponential Backoff Retry
 *
 * Wraps async operations with configurable retry logic, jitter,
 * and retryable HTTP status code filtering.
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // ms
  maxDelay: number; // ms
  retryableStatusCodes: number[];
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

/**
 * Error subclass that carries an HTTP status code.
 * Adapters should throw this so the retry logic can decide
 * whether to retry based on the status code.
 */
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Execute an async function with exponential backoff retry.
 *
 * Uses jittered exponential backoff to avoid thundering-herd effects.
 * Only retries on errors with a status code in the retryable set.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> {
  const cfg: RetryConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on the last attempt
      if (attempt === cfg.maxRetries) break;

      // Check if the error is retryable
      if (!isRetryable(lastError, cfg.retryableStatusCodes)) break;

      // Calculate delay with jitter: base * 2^attempt * random(0.5, 1.5)
      const exponentialDelay = cfg.baseDelay * Math.pow(2, attempt);
      const jitter = 0.5 + Math.random(); // [0.5, 1.5)
      const delay = Math.min(exponentialDelay * jitter, cfg.maxDelay);

      await sleep(delay);
    }
  }

  throw lastError;
}

function isRetryable(error: Error, retryableStatusCodes: number[]): boolean {
  if (error instanceof HttpError) {
    return retryableStatusCodes.includes(error.statusCode);
  }

  // Network / timeout errors are always retryable
  const message = error.message.toLowerCase();
  if (
    message.includes("fetch failed") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("econnrefused") ||
    message.includes("socket hang up") ||
    message.includes("network")
  ) {
    return true;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
