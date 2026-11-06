import type {
  SqliteDriver,
  SqliteStatement,
  SqlValue,
  WorkerPayload,
  WorkerResponse,
} from '@dayline/db';

export interface WebDatabase {
  driver: SqliteDriver;
  storage: 'opfs' | 'memory' | 'tauri';
  sqliteVersion: string;
  databaseName: string;
}

export interface OpenWebDatabaseOptions {
  databaseName?: string;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function openWebDatabase(
  options: OpenWebDatabaseOptions = {},
): Promise<WebDatabase> {
  if ('__TAURI_INTERNALS__' in window) {
    throw new Error('桌面端 SQLite 适配器尚未接入，暂时使用本地缓存');
  }
  if (typeof Worker === 'undefined') {
    throw new Error('当前环境不支持 Web Worker，无法启用 SQLite');
  }

  const worker = new Worker(new URL('./sqlite.worker.ts', import.meta.url), {
    type: 'module',
  });

  let nextId = 1;
  const pending = new Map<number, PendingRequest>();

  function rejectAll(error: Error) {
    for (const request of pending.values()) {
      request.reject(error);
    }
    pending.clear();
  }

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);

    if (response.ok) {
      request.resolve(response.result);
    } else {
      request.reject(new Error(response.error));
    }
  };

  worker.onerror = (event) => {
    rejectAll(new Error(event.message || 'SQLite Worker 启动失败'));
  };

  worker.onmessageerror = () => {
    rejectAll(new Error('SQLite Worker 消息无法解析'));
  };

  function request<T>(payload: WorkerPayload): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      worker.postMessage({ ...payload, id });
    });
  }

  const driver: SqliteDriver = {
    all<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): Promise<T[]> {
      return request<T[]>({ type: 'all', sql, params });
    },
    run(sql: string, params?: SqlValue[]): Promise<void> {
      return request<void>({ type: 'run', sql, params });
    },
    batch(statements: SqliteStatement[]): Promise<void> {
      return request<void>({ type: 'batch', statements });
    },
    close(): void {
      worker.terminate();
      rejectAll(new Error('数据库连接已关闭'));
    },
  };

  try {
    const info = await withTimeout(
      request<{ storage: 'opfs' | 'memory'; sqlite: string; databaseName: string }>({
        type: 'init',
        databaseName: options.databaseName,
      }),
      20_000,
      'SQLite 初始化超时',
    );

    return {
      driver,
      storage: info.storage,
      sqliteVersion: info.sqlite,
      databaseName: info.databaseName,
    };
  } catch (error) {
    worker.terminate();
    rejectAll(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/** Deletes a user database file from OPFS. Safe to call when OPFS is absent. */
export async function deleteWebDatabase(databaseName: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return false;
  try {
    const root = await navigator.storage.getDirectory();
    const safeName = databaseName.replace(/[^a-zA-Z0-9_.-]/g, '-');
    await root.removeEntry(safeName);
    return true;
  } catch (error) {
    console.warn('[sqlite] remove OPFS database failed:', error);
    return false;
  }
}
