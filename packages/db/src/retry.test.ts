import { describe, expect, it, vi } from 'vitest';
import { createRetryingDriver } from './retry';
import type { SqliteDriver } from './driver';

function failingDriver(failures: number, message = 'SQLITE_BUSY: database is locked') {
  let attempts = 0;
  const driver: SqliteDriver = {
    async all<T>() {
      attempts += 1;
      if (attempts <= failures) throw new Error(message);
      return [{ ok: 1 }] as T[];
    },
    async run() {
      attempts += 1;
      if (attempts <= failures) throw new Error(message);
    },
    async batch() {
      attempts += 1;
      if (attempts <= failures) throw new Error(message);
    },
    close: vi.fn(),
  };
  return { driver, attempts: () => attempts };
}

describe('retrying driver', () => {
  it('retries transient SQLite lock errors', async () => {
    const { driver, attempts } = failingDriver(2);
    const retrying = createRetryingDriver(driver, { attempts: 4, baseDelayMs: 1 });
    const rows = await retrying.all<{ ok: number }>('select 1');
    expect(rows[0]?.ok).toBe(1);
    expect(attempts()).toBe(3);
  });

  it('does not retry non-transient errors', async () => {
    const { driver, attempts } = failingDriver(1, 'no such table: task');
    const retrying = createRetryingDriver(driver, { attempts: 4, baseDelayMs: 1 });
    await expect(retrying.run('select 1')).rejects.toThrow('no such table');
    expect(attempts()).toBe(1);
  });
});
