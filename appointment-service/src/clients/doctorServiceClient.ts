import { config } from '../config/env';
import { BusinessError } from '../utils/BusinessError';
import { syncGet } from './httpClient';

export interface DoctorTiming {
  dayOfWeek: number; // 1=Monday .. 7=Sunday
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export interface WeeklySchedule {
  doctorId: number;
  fullName: string;
  departmentName: string;
  active: boolean;
  dailyLimit: number;
  timings: DoctorTiming[];
}

/**
 * GET /internal/doctors/{id}/weekly-schedule
 * 404 or active=false → DOC_NOT_FOUND (APT-R3). Any other failure/timeout/5xx → SERVICE_UNAVAILABLE.
 */
export async function getWeeklySchedule(
  doctorId: number,
  requestId?: string
): Promise<WeeklySchedule> {
  const url = `${config.doctorServiceUrl}/internal/doctors/${doctorId}/weekly-schedule`;
  const result = await syncGet<WeeklySchedule>(url, { requestId, notFoundReturnsNull: true });
  if (result === null || !result.active) {
    throw new BusinessError('DOC_NOT_FOUND', 404, 'Doctor not found.');
  }
  return result;
}
