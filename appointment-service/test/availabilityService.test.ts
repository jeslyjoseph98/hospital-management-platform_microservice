import { beforeEach, describe, expect, it, vi } from 'vitest';

const getWeeklyScheduleMock = vi.fn();
const getCountersForDoctorDatesMock = vi.fn();

vi.mock('../src/clients/doctorServiceClient', () => ({
  getWeeklySchedule: (...args: unknown[]) => getWeeklyScheduleMock(...args)
}));

vi.mock('../src/repositories/appointmentRepository', () => ({
  getCountersForDoctorDates: (...args: unknown[]) => getCountersForDoctorDatesMock(...args)
}));

import { computeAvailability } from '../src/services/availabilityService';
import { todayDateStr, addDays, dayOfWeekNumber } from '../src/utils/datetime';

describe('availabilityService.computeAvailability', () => {
  beforeEach(() => {
    getWeeklyScheduleMock.mockReset();
    getCountersForDoctorDatesMock.mockReset();
  });

  it('marks a day with no timing as NOT_AVAILABLE', async () => {
    const today = todayDateStr();
    getWeeklyScheduleMock.mockResolvedValue({
      doctorId: 3,
      fullName: 'Dr. Rahul Menon',
      departmentName: 'Cardiology',
      active: true,
      dailyLimit: 50,
      timings: [] // no timings at all -> every day NOT_AVAILABLE
    });
    getCountersForDoctorDatesMock.mockResolvedValue(new Map());

    const result = await computeAvailability(3);
    expect(result.dates).toHaveLength(7);
    for (const d of result.dates) {
      expect(d.status).toBe('NOT_AVAILABLE');
    }
    void today;
  });

  it('marks a fully booked day as FULLY_BOOKED when remaining <= 0', async () => {
    const today = todayDateStr();
    const dow = dayOfWeekNumber(today);
    getWeeklyScheduleMock.mockResolvedValue({
      doctorId: 3,
      fullName: 'Dr. Rahul Menon',
      departmentName: 'Cardiology',
      active: true,
      dailyLimit: 50,
      timings: [{ dayOfWeek: dow, startTime: '00:00', endTime: '23:59' }]
    });
    const counters = new Map<string, number>();
    counters.set(today, 50);
    getCountersForDoctorDatesMock.mockResolvedValue(counters);

    const result = await computeAvailability(3);
    const todayEntry = result.dates.find((d) => d.date === today)!;
    expect(todayEntry.booked).toBe(50);
    expect(todayEntry.remaining).toBe(0);
    expect(todayEntry.status).toBe('FULLY_BOOKED');
  });

  it('marks today as CLOSED when current time is past endTime', async () => {
    const today = todayDateStr();
    const dow = dayOfWeekNumber(today);
    getWeeklyScheduleMock.mockResolvedValue({
      doctorId: 3,
      fullName: 'Dr. Rahul Menon',
      departmentName: 'Cardiology',
      active: true,
      dailyLimit: 50,
      // endTime in the past (00:01) guarantees current time >= endTime
      timings: [{ dayOfWeek: dow, startTime: '00:00', endTime: '00:01' }]
    });
    getCountersForDoctorDatesMock.mockResolvedValue(new Map());

    const result = await computeAvailability(3);
    const todayEntry = result.dates.find((d) => d.date === today)!;
    expect(todayEntry.status).toBe('CLOSED');
  });

  it('marks a day as AVAILABLE when there is remaining capacity and (if today) time has not closed', async () => {
    const today = todayDateStr();
    const future = addDays(today, 3);
    const dow = dayOfWeekNumber(future);
    getWeeklyScheduleMock.mockResolvedValue({
      doctorId: 3,
      fullName: 'Dr. Rahul Menon',
      departmentName: 'Cardiology',
      active: true,
      dailyLimit: 50,
      timings: [{ dayOfWeek: dow, startTime: '10:00', endTime: '13:00' }]
    });
    const counters = new Map<string, number>();
    counters.set(future, 10);
    getCountersForDoctorDatesMock.mockResolvedValue(counters);

    const result = await computeAvailability(3);
    const entry = result.dates.find((d) => d.date === future)!;
    expect(entry.booked).toBe(10);
    expect(entry.remaining).toBe(40);
    expect(entry.status).toBe('AVAILABLE');
  });

  it('defaults booked to 0 when there is no counter row for a date', async () => {
    const today = todayDateStr();
    const future = addDays(today, 2);
    const dow = dayOfWeekNumber(future);
    getWeeklyScheduleMock.mockResolvedValue({
      doctorId: 3,
      fullName: 'Dr. Rahul Menon',
      departmentName: 'Cardiology',
      active: true,
      dailyLimit: 50,
      timings: [{ dayOfWeek: dow, startTime: '10:00', endTime: '13:00' }]
    });
    getCountersForDoctorDatesMock.mockResolvedValue(new Map());

    const result = await computeAvailability(3);
    const entry = result.dates.find((d) => d.date === future)!;
    expect(entry.booked).toBe(0);
    expect(entry.remaining).toBe(50);
    expect(entry.status).toBe('AVAILABLE');
  });
});
