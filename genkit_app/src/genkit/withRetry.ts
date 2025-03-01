/**
 * Utility function to automatically retry async operations with exponential backoff
 * Particularly useful for API calls that may fail due to transient issues
 */

// Types for the retry configuration
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds before the first retry (default: 1000ms) */
  initialDelayMs?: number;
  /** Backoff factor to multiply delay by after each retry (default: 2) */
  backoffFactor?: number;
  /** Maximum delay in milliseconds between retries (default: 30000ms) */
  maxDelayMs?: number;
  /** Function to determine if an error is retryable (default: all errors are retryable) */
  isRetryable?: (error: unknown) => boolean;
  /** Optional callback function that runs before each retry attempt */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

// Default retry configuration
const defaultOptions: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 100,
  backoffFactor: 4,
  maxDelayMs: 30000,
  isRetryable: () => true,
  onRetry: (error, attempt, delayMs) => {
    console.warn(
      `Operation failed (attempt ${attempt}), retrying in ${delayMs}ms:`,
      error
    );
  },
};

/**
 * Wraps an async function with retry logic
 *
 * @param operation - The async function to retry
 * @param options - Configuration options for retry behavior
 * @returns A wrapped function with the same signature as the input function
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  operation: T,
  options: RetryOptions = {}
): T {
  // Merge provided options with defaults
  const config: Required<RetryOptions> = {
    ...defaultOptions,
    ...options,
  };

  // Create and return the wrapped function
  const wrappedFn = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    let lastError: unknown;
    let attempt = 0;
    let delayMs = config.initialDelayMs;

    while (attempt <= config.maxRetries) {
      try {
        // Attempt the operation
        return operation(...args);
      } catch (error) {
        lastError = error;
        attempt++;

        // If we've used all retry attempts or the error isn't retryable, throw
        if (attempt > config.maxRetries || !config.isRetryable(error)) {
          throw error;
        }

        // Call the onRetry callback if provided
        config.onRetry(error, attempt, delayMs);

        // Wait before the next retry
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        // Calculate the next delay with exponential backoff
        delayMs = Math.min(delayMs * config.backoffFactor, config.maxDelayMs);
      }
    }

    // This should never be reached due to the throw in the catch block,
    // but TypeScript requires a return statement
    throw lastError;
  };

  return wrappedFn as T;
}

/**
 * Helper function to determine if an error is likely a transient issue
 * that would benefit from a retry
 */
export function isTransientError(error: unknown): boolean {
  // Network errors
  if (error instanceof TypeError && error.message.includes("network")) {
    return true;
  }

  // Rate limiting or server errors
  if (error instanceof Error) {
    const status = (error as any).status || (error as any).statusCode;
    if (status) {
      // 429 Too Many Requests, 5xx Server Errors
      return status === 429 || (status >= 500 && status < 600);
    }

    // Check for common timeout or connection error messages
    const errorMsg = error.message.toLowerCase();
    return (
      errorMsg.includes("timeout") ||
      errorMsg.includes("econnreset") ||
      errorMsg.includes("econnrefused") ||
      errorMsg.includes("etimedout") ||
      errorMsg.includes("network error") ||
      errorMsg.includes("too many requests") ||
      errorMsg.includes("server error") ||
      errorMsg.includes("unavailable")
    );
  }

  return false;
}

/**
 * Predefined retry configuration for GenKit API calls
 */
export const genkitRetryOptions: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 2000,
  backoffFactor: 2,
  maxDelayMs: 20000,
  isRetryable: isTransientError,
  onRetry: (error, attempt, delayMs) => {
    console.warn(
      `GenKit API call failed (attempt ${attempt}), retrying in ${delayMs}ms:`,
      error instanceof Error ? error.message : error
    );
  },
};
