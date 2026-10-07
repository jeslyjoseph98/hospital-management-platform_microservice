import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMinutes,
  ageFromDob,
  compareTimeStr,
  dayOfWeekName,
  dayOfWeekNumber,
  formatDateDMY,
  minutesBetween
} from '../src/utils/datetime';

describe('datetime utils', () => {
  it('addDays adds calendar days correctly, including month rollover', () => {
    expect(addDays('2026-09-28', 0)).toBe('2026-09-28');
    expect(addDays('2026-09-28', 1)).toBe('2026-09-29');
    expect(addDays('2026-09-28', 6)).toBe('2026-10-04');
  });

  it('dayOfWeekName returns the correct weekday name', () => {
    // 2026-09-28 is a Monday
    expect(dayOfWeekName('2026-09-28')).toBe('MONDAY');
    expect(dayOfWeekName('2026-09-29')).toBe('TUESDAY');
    expect(dayOfWeekName('2026-10-04')).toBe('SUNDAY');
  });

  it('dayOfWeekNumber returns 1=Monday..7=Sunday', () => {
    expect(dayOfWeekNumber('2026-09-28')).toBe(1); // Monday
    expect(dayOfWeekNumber('2026-10-04')).toBe(7); // Sunday
  });

  it('compareTimeStr compares HH:MM strings', () => {
    expect(compareTimeStr('10:00', '13:00')).toBeLessThan(0);
    expect(compareTimeStr('13:00', '13:00')).toBe(0);
    expect(compareTimeStr('14:00', '13:00')).toBeGreaterThan(0);
  });

  it('minutesBetween computes minutes difference', () => {
    expect(minutesBetween('10:00', '13:00')).toBe(180);
    expect(minutesBetween('09:00', '09:30')).toBe(30);
  });

  it('addMinutes adds minutes to a time string', () => {
    expect(addMinutes('10:00', 48)).toBe('10:48');
    expect(addMinutes('10:00', 0)).toBe('10:00');
    expect(addMinutes('23:50', 20)).toBe('24:10');
  });

  it('formatDateDMY formats YYYY-MM-DD as dd-MM-yyyy', () => {
    expect(formatDateDMY('2026-09-28')).toBe('28-09-2026');
  });

  it('ageFromDob computes age as of a given date', () => {
    expect(ageFromDob('1988-05-15', new Date('2026-09-28T12:00:00Z'))).toBe(38);
    // birthday not yet reached this year
    expect(ageFromDob('1988-10-15', new Date('2026-09-28T12:00:00Z'))).toBe(37);
  });
});
