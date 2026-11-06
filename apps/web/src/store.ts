import {
  createSeedState,
  normalizePreferences,
  type AppState,
} from '@dayline/core';

const STATE_KEY = 'dayline.state.v1';
const THEME_KEY = 'dayline.theme';

let activeStateKey = STATE_KEY;

export function setStateStorageKey(key: string): void {
  activeStateKey = key || STATE_KEY;
}

export function loadState(
  key: string = activeStateKey,
  fallback?: AppState,
): AppState {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback ?? createSeedState();
    const parsed = JSON.parse(raw) as AppState;
    if (
      parsed.version !== 1 ||
      !parsed.profile ||
      !Array.isArray(parsed.projects) ||
      !Array.isArray(parsed.tasks) ||
      !Array.isArray(parsed.tags)
    ) {
      return fallback ?? createSeedState();
    }
    return {
      ...parsed,
      folders: parsed.folders ?? [],
      filters: parsed.filters ?? [],
      templates: parsed.templates ?? [],
      comments: parsed.comments ?? [],
      attachments: parsed.attachments ?? [],
      habits: parsed.habits ?? [],
      habitCheckins: parsed.habitCheckins ?? [],
      focusSessions: parsed.focusSessions ?? [],
      countdowns: parsed.countdowns ?? [],
      projects: parsed.projects.map((project) => ({
        ...project,
        folderId: project.folderId ?? null,
      })),
      recurrenceSeries: parsed.recurrenceSeries ?? [],
      recurrenceExceptions: parsed.recurrenceExceptions ?? [],
      reminders: parsed.reminders ?? [],
      preferences: normalizePreferences(parsed.preferences),
      tasks: parsed.tasks.map((task) => ({
        ...task,
        parentId: task.parentId ?? null,
        seriesId: task.seriesId ?? null,
        occurrenceDate: task.occurrenceDate ?? null,
        occurrenceIndex: task.occurrenceIndex ?? null,
        progress: task.progress ?? 0,
        checklist: task.checklist ?? [],
      })),
    };
  } catch {
    return fallback ?? createSeedState();
  }
}

export function saveState(state: AppState, key: string = activeStateKey): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Quota or private mode: keep the in-memory state usable.
  }
}

export function loadTheme(): 'light' | 'dark' {
  return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

export function saveTheme(theme: 'light' | 'dark'): void {
  window.localStorage.setItem(THEME_KEY, theme);
}
