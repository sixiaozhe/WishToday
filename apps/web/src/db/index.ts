import { SqliteRepository, createRetryingDriver } from '@dayline/db';
import type { AppState } from '@dayline/core';
import { openWebDatabase, type WebDatabase } from './opfsDriver';

export interface OpenDatabaseResult extends WebDatabase {
  repository: SqliteRepository;
  state: AppState;
}

export interface OpenAppDatabaseOptions {
  databaseName?: string;
  profileName?: string;
  /** New users start with an empty inbox; the legacy default keeps demo data. */
  demo?: boolean;
}

function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

async function openDatabase(options: OpenAppDatabaseOptions): Promise<WebDatabase> {
  if (isTauri()) {
    const { openTauriDatabase } = await import('./tauriDriver');
    return openTauriDatabase({ databaseName: options.databaseName });
  }
  return openWebDatabase({ databaseName: options.databaseName });
}

export async function openAppDatabase(
  options: OpenAppDatabaseOptions = {},
): Promise<OpenDatabaseResult> {
  const database = await openDatabase(options);
  const driver = createRetryingDriver(database.driver);
  const repository = new SqliteRepository(driver);
  let state = await repository.initialize({
    profileName: options.profileName,
    demo: options.demo,
  });

  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('reset')) {
    state = await repository.reset({
      profileName: options.profileName,
      demo: options.demo,
    });
    const url = new URL(window.location.href);
    url.searchParams.delete('reset');
    window.history.replaceState(null, '', url.toString());
  }

  if (import.meta.env.DEV) {
    (window as unknown as { __daylineDb?: SqliteRepository }).__daylineDb = repository;
  }

  return { ...database, driver, repository, state };
}
