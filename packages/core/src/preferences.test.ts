import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, normalizePreferences } from './preferences';

describe('calendar preferences', () => {
  it('provides the default 08-21 range', () => {
    expect(DEFAULT_PREFERENCES.calendar).toEqual({ startHour: 8, endHour: 21 });
    expect(normalizePreferences(null).calendar).toEqual({
      startHour: 8,
      endHour: 21,
    });
  });

  it('clamps to valid hours', () => {
    expect(normalizePreferences({ calendar: { startHour: -4, endHour: 30 } }).calendar).toEqual({
      startHour: 0,
      endHour: 24,
    });
  });

  it('keeps end after start', () => {
    expect(normalizePreferences({ calendar: { startHour: 20, endHour: 10 } }).calendar).toEqual({
      startHour: 20,
      endHour: 21,
    });
  });
});
