import type { SqliteDriver, SqliteStatement, SqlValue } from './driver';

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const RETRYABLE = [
  'SQLITE_BUSY',
  'SQLITE_LOCKED',
  'SQLITE_IOERR',
  'database is locked',
  'database table is locked',
  'disk I/O error',
  'unable to open database',
];

function isRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE.some((token) => message.toLowerCase().includes(token.toLowerCase()));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Wraps a SQLite driver with bounded retries for transient OPFS / lock / I/O
 * errors. Batch calls are safe to retry because the worker rolls the
 * transaction back on failure.
 */
export function createRetryingDriver(
  driver: SqliteDriver,
  options: RetryOptions = {},
): SqliteDriver {
  const attempts = Math.max(1, options.attempts ?? 4);
  const baseDelay = Math.max(10, options.baseDelayMs ?? 120);
  const maxDelay = Math.max(baseDelay, options.maxDelayMs ?? 1200);

  async function runWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === attempts - 1) break;
        const delay = Math.min(maxDelay, baseDelay * 2 ** attempt);
        await wait(delay);
      }
    }
    throw lastError;
  }

  return {
    all<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): Promise<T[]> {
      return runWithRetry(() => driver.all<T>(sql, params));
    },
    run(sql: string, params?: SqlValue[]): Promise<void> {
      return runWithRetry(() => driver.run(sql, params));
    },
    batch(statements: SqliteStatement[]): Promise<void> {
      return runWithRetry(() => driver.batch(statements));
    },
    close(): void {
      driver.close();
    },
  };
}
