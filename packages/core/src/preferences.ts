import type { AppPreferences } from './types';

export const DEFAULT_PREFERENCES: AppPreferences = {
  calendar: {
    startHour: 8,
    endHour: 21,
  },
};

export function normalizePreferences(
  value: Partial<AppPreferences> | null | undefined,
): AppPreferences {
  const start = Math.round(value?.calendar?.startHour ?? 8);
  const end = Math.round(value?.calendar?.endHour ?? 21);
  const startHour = Math.min(23, Math.max(0, start));
  const endHour = Math.min(24, Math.max(1, end));
  return {
    calendar: {
      startHour,
      endHour: endHour > startHour ? endHour : Math.min(24, startHour + 1),
    },
  };
}
