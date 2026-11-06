export type SqlValue = string | number | null;

export interface SqliteStatement {
  sql: string;
  params?: SqlValue[];
}

export interface SqliteDriver {
  all<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  batch(statements: SqliteStatement[]): Promise<void>;
  close(): void;
}

export type WorkerPayload =
  | { type: 'init'; databaseName?: string }
  | { type: 'all'; sql: string; params?: SqlValue[] }
  | { type: 'run'; sql: string; params?: SqlValue[] }
  | { type: 'batch'; statements: SqliteStatement[] };

export type WorkerRequest = WorkerPayload & { id: number };

export type WorkerResponse =
  | { id: number; ok: true; result?: unknown }
  | { id: number; ok: false; error: string };
