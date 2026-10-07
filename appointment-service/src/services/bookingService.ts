import { PoolClient } from 'pg';
import { getWeeklySchedule } from '../clients/doctorServiceClient';
import { getPatient } from '../clients/userServiceClient';
import { withTransaction } from '../db/pool';
import * as appointmentRepository from '../repositories/appointmentRepository';
import * as outboxRepository from '../repositories/outboxRepository';
import { BusinessError } from '../utils/BusinessError';
import {
  addDays,
  addMinutes,
  compareTimeStr,
  dayOfWeekNumber,
  formatDateDMY,
  minutesBetween,
  nowTimeStr,
  todayDateStr
} from '../utils/datetime';

export interface BookAppointmentInput {
  patientId: number;
  doctorId: number;
  appointmentDate: string;
  reason: string | null;
}

export interface BookAppointmentResult {
  appointmentId: number;
  appointmentCode: string;
  tokenNumber: number;
  reportingTime: string;
  appointmentDate: string;
  doctorName: string;
  departmentName: string;
  consultationTimings: string;
  patientName: string;
  patientCode: string;
  status: 'BOOKED';
}

/**
 * Books an appointment per SVC-04 §5.2. Steps 2 and 4 (the two sync calls) run before the
 * transaction so the per-doctor-per-day row lock (step 7) is held only for fast local work.
 */
export async function bookAppointment(
  input: BookAppointmentInput,
  requestId?: string
): Promise<BookAppointmentResult> {
  // Step 2 (APT-R3): doctor must exist and be active.
  const schedule = await getWeeklySchedule(input.doctorId, requestId);

  // Step 3: date range + weekday timing + booking-closed checks (APT-R4, R5, R6).
  const today = todayDateStr();
  const maxDate = addDays(today, 6);
  if (input.appointmentDate < today || input.appointmentDate > maxDate) {
    throw new BusinessError('APT_DATE_OUT_OF_RANGE', 409, 'Appointment date is out of range.');
  }

  const dow = dayOfWeekNumber(input.appointmentDate);
  const timing = schedule.timings.find((t) => t.dayOfWeek === dow);
  if (!timing) {
    throw new BusinessError(
      'APT_DOCTOR_NOT_AVAILABLE',
      409,
      `${schedule.fullName} is not available on this day.`
    );
  }

  if (input.appointmentDate === today && compareTimeStr(nowTimeStr(), timing.endTime) >= 0) {
    throw new BusinessError('APT_BOOKING_CLOSED', 409, 'Booking is closed for today.');
  }

  // Step 4: fetch patient snapshot data.
  const patient = await getPatient(input.patientId, requestId);

  const dailyLimit = schedule.dailyLimit;
  const minutesPerPatient = Math.max(
    1,
    Math.floor(minutesBetween(timing.startTime, timing.endTime) / dailyLimit)
  );

  try {
    const outcome = await withTransaction(async (client: PoolClient) => {
      // Steps 6-7: upsert + row-lock the counter.
      const bookedCount = await appointmentRepository.upsertAndLockCounter(
        client,
        input.doctorId,
        input.appointmentDate
      );

      // Step 8 / APT-R7: patient already booked with this doctor on this date.
      const alreadyBooked = await appointmentRepository.existsForPatientDoctorDate(
        client,
        input.patientId,
        input.doctorId,
        input.appointmentDate
      );
      if (alreadyBooked) {
        throw new BusinessError('APT_ALREADY_BOOKED', 409, 'You already have an appointment with this doctor on this date.');
      }

      // Step 9 / APT-R8: fully booked.
      if (bookedCount >= dailyLimit) {
        throw new BusinessError(
          'APT_DOCTOR_FULLY_BOOKED',
          409,
          `${schedule.fullName} is fully booked on ${formatDateDMY(input.appointmentDate)}. Please choose another date.`
        );
      }

      // Step 10: token number + reporting time (APT-R9, APT-R10).
      const tokenNumber = bookedCount + 1;
      const reportingTime = addMinutes(timing.startTime, (tokenNumber - 1) * minutesPerPatient);

      // Step 11: insert appointment.
      const appointmentId = await appointmentRepository.insertAppointment(client, {
        patientId: input.patientId,
        doctorId: input.doctorId,
        appointmentDate: input.appointmentDate,
        tokenNumber,
        reportingTime,
        reason: input.reason,
        patientName: patient.name,
        patientCode: patient.patientCode,
        patientGender: patient.gender,
        patientDob: patient.dateOfBirth,
        doctorName: schedule.fullName,
        departmentName: schedule.departmentName,
        consultationStart: timing.startTime,
        consultationEnd: timing.endTime
      });

      // Step 12: appointment code.
      const appointmentCode = await appointmentRepository.setAppointmentCode(client, appointmentId);

      // Step 13: increment counter.
      await appointmentRepository.incrementCounter(client, input.doctorId, input.appointmentDate);

      // Step 14: outbox event.
      await outboxRepository.insertOutboxEvent(client, 'appointment.booked', String(appointmentId), {
        appointmentId,
        appointmentCode,
        patientId: input.patientId,
        doctorName: schedule.fullName,
        departmentName: schedule.departmentName,
        appointmentDate: input.appointmentDate,
        tokenNumber,
        reportingTime
      });

      return {
        appointmentId,
        appointmentCode,
        tokenNumber,
        reportingTime,
        appointmentDate: input.appointmentDate,
        doctorName: schedule.fullName,
        departmentName: schedule.departmentName,
        consultationTimings: `${timing.startTime} - ${timing.endTime}`,
        patientName: patient.name,
        patientCode: patient.patientCode,
        status: 'BOOKED' as const
      };
    });

    return outcome;
  } catch (err: unknown) {
    // Safety net: unique-constraint violation (23505) maps to the matching business error,
    // in case two requests raced past the lock-based check (shouldn't normally happen).
    if (isPgUniqueViolation(err)) {
      const constraint = (err as { constraint?: string }).constraint;
      if (constraint === 'uq_apt_patient') {
        throw new BusinessError(
          'APT_ALREADY_BOOKED',
          409,
          'You already have an appointment with this doctor on this date.'
        );
      }
      if (constraint === 'uq_apt_token') {
        throw new BusinessError(
          'APT_DOCTOR_FULLY_BOOKED',
          409,
          `${schedule.fullName} is fully booked on ${formatDateDMY(input.appointmentDate)}. Please choose another date.`
        );
      }
    }
    throw err;
  }
}

function isPgUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}
