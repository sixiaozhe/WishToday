import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import schemaSql from '../../../../docs/specs/schema-v1.sql?raw';
import type { SqlValue, WorkerRequest, WorkerResponse } from '@dayline/db';

type StorageKind = 'opfs' | 'memory';

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (response: WorkerResponse) => void;
};

let sqlite3: any = null;
let db: any = null;
let storage: StorageKind = 'memory';
let databaseName = 'dayline.sqlite3';

async function ensureDatabase(name = databaseName): Promise<void> {
  if (db) return;
  databaseName = name.replace(/[^a-zA-Z0-9_.-]/g, '-') || 'dayline.sqlite3';

  sqlite3 = await sqlite3InitModule();

  const vfsList: string[] = sqlite3.capi?.sqlite3_js_vfs_list?.() ?? [];
  console.info('[sqlite] available VFS:', vfsList);

  // The package documents `'opfs' in sqlite3`, but the capability lives on the
  // oo1 namespace in some builds. Try the constructor directly and fall back.
  if (sqlite3.oo1?.OpfsDb && vfsList.includes('opfs')) {
    try {
      db = new sqlite3.oo1.OpfsDb(`/${databaseName}`);
      storage = 'opfs';
    } catch (error) {
      console.warn('[sqlite] OPFS open failed, falling back to memory:', error);
      db = new sqlite3.oo1.DB(':memory:', 'ct');
      storage = 'memory';
    }
  } else {
    // OPFS needs a Worker plus COOP/COEP headers. Keep the app usable if the
    // host cannot provide them, but warn the UI that data will not persist.
    db = new sqlite3.oo1.DB(':memory:', 'ct');
    storage = 'memory';
  }

  db.exec('PRAGMA foreign_keys = ON;');

  const version = Number(db.selectValue('PRAGMA user_version') ?? 0);
  if (version < 1) {
    // OPFS VFS does not support WAL; the desktop SQLite adapter can enable it.
    const schema = schemaSql.replace(/PRAGMA\s+journal_mode\s*=\s*WAL\s*;/i, '');
    db.exec(schema);
    db.exec('PRAGMA user_version = 1;');
  }
}

function execAll(sql: string, params: SqlValue[] = []): Record<string, SqlValue>[] {
  return db.exec({
    sql,
    bind: params,
    rowMode: 'object',
    returnValue: 'resultRows',
  }) as Record<string, SqlValue>[];
}

function execRun(sql: string, params: SqlValue[] = []): void {
  db.exec({ sql, bind: params });
}

async function handle(request: WorkerRequest): Promise<void> {
  try {
    await ensureDatabase(request.type === 'init' ? request.databaseName : undefined);

    let result: unknown = null;
    switch (request.type) {
      case 'init':
        result = {
          storage,
          sqlite: String(db.selectValue('select sqlite_version()') ?? ''),
          databaseName,
        };
        break;
      case 'all':
        result = execAll(request.sql, request.params);
        break;
      case 'run':
        execRun(request.sql, request.params);
        break;
      case 'batch':
        db.exec('BEGIN');
        try {
          for (const statement of request.statements) {
            execRun(statement.sql, statement.params);
          }
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
        break;
    }

    scope.postMessage({ id: request.id, ok: true, result });
  } catch (error) {
    scope.postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

scope.onmessage = (event) => {
  void handle(event.data);
};
