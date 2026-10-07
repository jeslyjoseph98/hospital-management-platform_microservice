import { describe, expect, it } from 'vitest';
import { formatDate, formatFee, formatTime } from '../utils/format';
import { emptyTimingsState, validateTimings } from '../components/WeeklyTimingsEditor';

describe('formatting (AW-R8)', () => {
  it('formats dates as dd-MM-yyyy', () => {
    expect(formatDate('2026-10-02')).toBe('02-10-2026');
  });

  it('formats times as hh:mm AM/PM', () => {
    expect(formatTime('09:05')).toBe('09:05 AM');
    expect(formatTime('13:30')).toBe('01:30 PM');
    expect(formatTime('00:00')).toBe('12:00 AM');
  });

  it('formats fee with rupee symbol and 2 decimals', () => {
    expect(formatFee(500)).toBe('₹500.00');
    expect(formatFee(99.5)).toBe('₹99.50');
  });
});

describe('validateTimings', () => {
  it('requires end time after start time for enabled rows', () => {
    const state = emptyTimingsState();
    state[1] = { enabled: true, startTime: '10:00', endTime: '09:00' };
    const errors = validateTimings(state);
    expect(errors[1]).toMatch(/end time must be after start time/i);
  });

  it('ignores disabled rows', () => {
    const state = emptyTimingsState();
    state[2] = { enabled: false, startTime: '', endTime: '' };
    expect(validateTimings(state)).toEqual({});
  });

  it('passes for a valid enabled row', () => {
    const state = emptyTimingsState();
    state[3] = { enabled: true, startTime: '10:00', endTime: '13:00' };
    expect(validateTimings(state)).toEqual({});
  });
});
