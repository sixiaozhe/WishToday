import { invoke } from '@tauri-apps/api/core';
import schemaSql from '../../../../docs/specs/schema-v1.sql?raw';
import type { SqliteDriver, SqlValue } from '@dayline/db';
import type { WebDatabase } from './opfsDriver';

interface TauriDbInfo {
  storage: 'tauri';
  sqlite: string;
  databaseName?: string;
  database_name?: string;
}

export async function openTauriDatabase(
  options: { databaseName?: string } = {},
): Promise<WebDatabase> {
  const databaseName = options.databaseName ?? 'dayline.sqlite3';
  const info = await invoke<TauriDbInfo>('db_open', {
    databaseName,
    schema: schemaSql,
  });

  const driver: SqliteDriver = {
    all<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): Promise<T[]> {
      return invoke<T[]>('db_all', {
        databaseName,
        sql,
        params: params ?? [],
      });
    },
    run(sql: string, params?: SqlValue[]): Promise<void> {
      return invoke<void>('db_run', {
        databaseName,
        sql,
        params: params ?? [],
      });
    },
    batch(statements): Promise<void> {
      return invoke<void>('db_batch', {
        databaseName,
        statements: statements.map((statement) => ({
          sql: statement.sql,
          params: statement.params ?? [],
        })),
      });
    },
    close(): void {
      void invoke('db_close', { databaseName });
    },
  };

  return {
    driver,
    storage: 'tauri',
    sqliteVersion: info.sqlite,
    databaseName: info.databaseName ?? info.database_name ?? databaseName,
  };
}
