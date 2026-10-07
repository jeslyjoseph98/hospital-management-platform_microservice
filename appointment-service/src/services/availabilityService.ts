import { getWeeklySchedule, WeeklySchedule } from '../clients/doctorServiceClient';
import * as appointmentRepository from '../repositories/appointmentRepository';
import { addDays, compareTimeStr, dayOfWeekName, dayOfWeekNumber, nowTimeStr, todayDateStr } from '../utils/datetime';

export type DateAvailabilityStatus = 'AVAILABLE' | 'FULLY_BOOKED' | 'NOT_AVAILABLE' | 'CLOSED';

export interface DateAvailability {
  date: string;
  day: string;
  startTime?: string;
  endTime?: string;
  booked?: number;
  remaining?: number;
  status: DateAvailabilityStatus;
}

export interface AvailabilityResult {
  doctorId: number;
  doctorName: string;
  dailyLimit: number;
  dates: DateAvailability[];
}

/**
 * GET /api/v1/doctors/{id}/availability — SVC-04 §4.
 * Computes AVAILABLE / FULLY_BOOKED / NOT_AVAILABLE / CLOSED for today + next 6 days.
 */
export async function computeAvailability(
  doctorId: number,
  requestId?: string
): Promise<AvailabilityResult> {
  const schedule = await getWeeklySchedule(doctorId, requestId);

  const today = todayDateStr();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const counters = await appointmentRepository.getCountersForDoctorDates(doctorId, dates);

  const timingsByDay = new Map(schedule.timings.map((t) => [t.dayOfWeek, t]));
  const currentTime = nowTimeStr();

  const result: DateAvailability[] = dates.map((date) => {
    const dow = dayOfWeekNumber(date);
    const dayName = dayOfWeekName(date);
    const timing = timingsByDay.get(dow);

    if (!timing) {
      return { date, day: dayName, status: 'NOT_AVAILABLE' };
    }

    const booked = counters.get(date) ?? 0;
    const remaining = schedule.dailyLimit - booked;

    let status: DateAvailabilityStatus;
    if (date === today && compareTimeStr(currentTime, timing.endTime) >= 0) {
      status = 'CLOSED';
    } else if (remaining <= 0) {
      status = 'FULLY_BOOKED';
    } else {
      status = 'AVAILABLE';
    }

    return {
      date,
      day: dayName,
      startTime: timing.startTime,
      endTime: timing.endTime,
      booked,
      remaining,
      status
    };
  });

  return {
    doctorId: schedule.doctorId,
    doctorName: schedule.fullName,
    dailyLimit: schedule.dailyLimit,
    dates: result
  };
}

export type { WeeklySchedule };
