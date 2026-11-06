import { describe, expect, it } from 'vitest';
import {
  holidayInfo,
  isStatutoryHoliday,
  isStatutoryWorkday,
} from './holidays';

describe('2026 statutory holidays', () => {
  it('knows holiday periods and makeup workdays', () => {
    expect(holidayInfo('2026-10-01')).toMatchObject({ type: 'holiday', name: '国庆节' });
    expect(holidayInfo('2026-10-10')).toMatchObject({ type: 'workday' });
    expect(holidayInfo('2026-09-20')).toMatchObject({ type: 'workday' });
    expect(holidayInfo('2026-01-04')).toMatchObject({ type: 'workday' });
    expect(holidayInfo('2026-02-14')).toMatchObject({ type: 'workday' });
    expect(holidayInfo('2026-02-28')).toMatchObject({ type: 'workday' });
  });

  it('falls back to weekdays/weekends outside the table', () => {
    expect(isStatutoryWorkday('2026-10-12')).toBe(true);
    expect(isStatutoryWorkday('2026-10-11')).toBe(false);
    expect(isStatutoryHoliday('2026-10-11')).toBe(true);
    expect(isStatutoryHoliday('2026-10-12')).toBe(false);
  });

  it('excludes holidays from workdays and includes makeup workdays', () => {
    expect(isStatutoryWorkday('2026-10-01')).toBe(false);
    expect(isStatutoryWorkday('2026-10-10')).toBe(true);
    expect(isStatutoryHoliday('2026-10-01')).toBe(true);
    expect(isStatutoryHoliday('2026-10-10')).toBe(false);
  });
});
