import type { AppState } from '@dayline/core';

const AUTO_KEY = 'dayline.autobackup.v1';
const AUTO_AT_KEY = 'dayline.autobackup.at';

let activeAutoKey = AUTO_KEY;
let activeAutoAtKey = AUTO_AT_KEY;

export function setBackupStorageKey(key: string): void {
  activeAutoKey = key ? `${AUTO_KEY}.${key}` : AUTO_KEY;
  activeAutoAtKey = key ? `${AUTO_AT_KEY}.${key}` : AUTO_AT_KEY;
}

export interface AutoBackup {
  at: number;
  state: AppState;
}

export function readAutoBackup(): AutoBackup | null {
  try {
    const raw = window.localStorage.getItem(activeAutoKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AutoBackup;
    if (!parsed?.state?.profile || !Array.isArray(parsed.state.tasks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeAutoBackup(state: AppState): AutoBackup {
  const payload: AutoBackup = { at: Date.now(), state };
  try {
    window.localStorage.setItem(activeAutoKey, JSON.stringify(payload));
  } catch {
    // Large attachments can exceed the quota; the manual export still works.
  }
  try {
    window.localStorage.setItem(activeAutoAtKey, String(payload.at));
  } catch {
    // ignore
  }
  return payload;
}

/** Creates at most one automatic snapshot per day. */
export function maybeAutoBackup(state: AppState, force = false): AutoBackup | null {
  try {
    const at = Number(window.localStorage.getItem(activeAutoAtKey) ?? 0);
    const day = 24 * 60 * 60 * 1000;
    if (!force && at > 0 && Date.now() - at < day) return null;
  } catch {
    // Fall through to a write attempt.
  }
  return writeAutoBackup(state);
}
