import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, dayOfWeekNumber, todayDateStr } from '../src/utils/datetime';

const getWeeklyScheduleMock = vi.fn();
const getPatientMock = vi.fn();
const withTransactionMock = vi.fn();

const upsertAndLockCounterMock = vi.fn();
const existsForPatientDoctorDateMock = vi.fn();
const insertAppointmentMock = vi.fn();
const setAppointmentCodeMock = vi.fn();
const incrementCounterMock = vi.fn();
const insertOutboxEventMock = vi.fn();

vi.mock('../src/clients/doctorServiceClient', () => ({
  getWeeklySchedule: (...args: unknown[]) => getWeeklyScheduleMock(...args)
}));

vi.mock('../src/clients/userServiceClient', () => ({
  getPatient: (...args: unknown[]) => getPatientMock(...args)
}));

vi.mock('../src/db/pool', () => ({
  pool: {},
  withTransaction: (fn: (client: unknown) => Promise<unknown>) => withTransactionMock(fn)
}));

vi.mock('../src/repositories/appointmentRepository', () => ({
  upsertAndLockCounter: (...args: unknown[]) => upsertAndLockCounterMock(...args),
  existsForPatientDoctorDate: (...args: unknown[]) => existsForPatientDoctorDateMock(...args),
  insertAppointment: (...args: unknown[]) => insertAppointmentMock(...args),
  setAppointmentCode: (...args: unknown[]) => setAppointmentCodeMock(...args),
  incrementCounter: (...args: unknown[]) => incrementCounterMock(...args)
}));

vi.mock('../src/repositories/outboxRepository', () => ({
  insertOutboxEvent: (...args: unknown[]) => insertOutboxEventMock(...args)
}));

import { bookAppointment } from '../src/services/bookingService';
import { BusinessError } from '../src/utils/BusinessError';

const DOCTOR_SCHEDULE_BASE = {
  doctorId: 3,
  fullName: 'Dr. Rahul Menon',
  departmentName: 'Cardiology',
  active: true,
  dailyLimit: 50
};

const PATIENT = {
  patientId: 123,
  patientCode: 'PAT000123',
  name: 'John Mathew',
  phone: '9999999999',
  dateOfBirth: '1988-05-15',
  gender: 'MALE',
  address: 'Kochi'
};

function mockFakeClient() {
  return {};
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: withTransaction executes the callback with a fake client immediately.
  withTransactionMock.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => {
    return fn(mockFakeClient());
  });
  getPatientMock.mockResolvedValue(PATIENT);
  setAppointmentCodeMock.mockImplementation(async (_client: unknown, id: number) => 'APT' + String(id).padStart(8, '0'));
  insertAppointmentMock.mockResolvedValue(45);
  incrementCounterMock.mockResolvedValue(undefined);
  insertOutboxEventMock.mockResolvedValue(undefined);
  existsForPatientDoctorDateMock.mockResolvedValue(false);
});

describe('bookingService.bookAppointment', () => {
  it('APT-R3: doctor not found/inactive bubbles up DOC_NOT_FOUND from the client', async () => {
    getWeeklyScheduleMock.mockRejectedValue(new BusinessError('DOC_NOT_FOUND', 404, 'Doctor not found.'));

    await expect(
      bookAppointment({ patientId: 1, doctorId: 999, appointmentDate: todayDateStr(), reason: null })
    ).rejects.toMatchObject({ code: 'DOC_NOT_FOUND', status: 404 });

    expect(getPatientMock).not.toHaveBeenCalled();
  });

  it('APT-R4: date before today is out of range', async () => {
    getWeeklyScheduleMock.mockResolvedValue({ ...DOCTOR_SCHEDULE_BASE, timings: [] });
    const past = addDays(todayDateStr(), -1);

    await expect(
      bookAppointment({ patientId: 1, doctorId: 3, appointmentDate: past, reason: null })
    ).rejects.toMatchObject({ code: 'APT_DATE_OUT_OF_RANGE', status: 409 });
  });

  it('APT-R4: date more than 6 days ahead is out of range', async () => {
    getWeeklyScheduleMock.mockResolvedValue({ ...DOCTOR_SCHEDULE_BASE, timings: [] });
    const tooFar = addDays(todayDateStr(), 7);

    await expect(
      bookAppointment({ patientId: 1, doctorId: 3, appointmentDate: tooFar, reason: null })
    ).rejects.toMatchObject({ code: 'APT_DATE_OUT_OF_RANGE', status: 409 });
  });

  it('APT-R4: today and today+6 are both within range (not rejected for date reasons)', async () => {
    const today = todayDateStr();
    const sixDaysOut = addDays(today, 6);
    getWeeklyScheduleMock.mockResolvedValue({
      ...DOCTOR_SCHEDULE_BASE,
      timings: [
        { dayOfWeek: dayOfWeekNumber(today), startTime: '00:00', endTime: '23:59' },
        { dayOfWeek: dayOfWeekNumber(sixDaysOut), startTime: '00:00', endTime: '23:59' }
      ]
    });
    upsertAndLockCounterMock.mockResolvedValue(0);

    await expect(
      bookAppointment({ patientId: 1, doctorId: 3, appointmentDate: today, reason: null })
    ).resolves.toBeDefined();

    await expect(
      bookAppointment({ patientId: 1, doctorId: 3, appointmentDate: sixDaysOut, reason: null })
    ).resolves.toBeDefined();
  });

  it('APT-R5: doctor has no timing for that weekday -> APT_DOCTOR_NOT_AVAILABLE', async () => {
    const today = todayDateStr();
    const otherDow = ((dayOfWeekNumber(today) % 7) + 1) as number; // guaranteed different day
    getWeeklyScheduleMock.mockResolvedValue({
      ...DOCTOR_SCHEDULE_BASE,
      timings: [{ dayOfWeek: otherDow, startTime: '10:00', endTime: '13:00' }]
    });

    await expect(
      bookAppointment({ patientId: 1, doctorId: 3, appointmentDate: today, reason: null })
    ).rejects.toMatchObject({ code: 'APT_DOCTOR_NOT_AVAILABLE', status: 409 });
  });

  it('APT-R6: booking today after endTime has passed -> APT_BOOKING_CLOSED', async () => {
    const today = todayDateStr();
    getWeeklyScheduleMock.mockResolvedValue({
      ...DOCTOR_SCHEDULE_BASE,
      timings: [{ dayOfWeek: dayOfWeekNumber(today), startTime: '00:00', endTime: '00:01' }]
    });

    await expect(
      bookAppointment({ patientId: 1, doctorId: 3, appointmentDate: today, reason: null })
    ).rejects.toMatchObject({ code: 'APT_BOOKING_CLOSED', status: 409 });
  });

  it('APT-R7: patient already booked with this doctor on this date -> APT_ALREADY_BOOKED', async () => {
    const today = todayDateStr();
    getWeeklyScheduleMock.mockResolvedValue({
      ...DOCTOR_SCHEDULE_BASE,
      timings: [{ dayOfWeek: dayOfWeekNumber(today), startTime: '00:00', endTime: '23:59' }]
    });
    upsertAndLockCounterMock.mockResolvedValue(5);
    existsForPatientDoctorDateMock.mockResolvedValue(true);

    await expect(
      bookAppointment({ patientId: 1, doctorId: 3, appointmentDate: today, reason: null })
    ).rejects.toMatchObject({ code: 'APT_ALREADY_BOOKED', status: 409 });

    expect(insertAppointmentMock).not.toHaveBeenCalled();
  });

  it('APT-R8: booked_count >= dailyLimit -> APT_DOCTOR_FULLY_BOOKED with formatted message', async () => {
    const today = todayDateStr();
    getWeeklyScheduleMock.mockResolvedValue({
      ...DOCTOR_SCHEDULE_BASE,
      dailyLimit: 50,
      timings: [{ dayOfWeek: dayOfWeekNumber(today), startTime: '00:00', endTime: '23:59' }]
    });
    upsertAndLockCounterMock.mockResolvedValue(50);
    existsForPatientDoctorDateMock.mockResolvedValue(false);

    await expect(
      bookAppointment({ patientId: 1, doctorId: 3, appointmentDate: today, reason: null })
    ).rejects.toMatchObject({ code: 'APT_DOCTOR_FULLY_BOOKED', status: 409 });

    expect(insertAppointmentMock).not.toHaveBeenCalled();
  });

  it('APT-R9/R10: token = booked_count + 1, reporting time per spec example (10:00-13:00, limit 50, token 17 -> 10:48)', async () => {
    // Use a future date (not "today") so this test is independent of the current time of day
    // (APT-R6 only restricts booking *today* after endTime).
    const future = addDays(todayDateStr(), 3);
    getWeeklyScheduleMock.mockResolvedValue({
      ...DOCTOR_SCHEDULE_BASE,
      dailyLimit: 50,
      timings: [{ dayOfWeek: dayOfWeekNumber(future), startTime: '10:00', endTime: '13:00' }]
    });
    upsertAndLockCounterMock.mockResolvedValue(16); // -> token 17
    existsForPatientDoctorDateMock.mockResolvedValue(false);

    const result = await bookAppointment({
      patientId: 1,
      doctorId: 3,
      appointmentDate: future,
      reason: 'Chest pain on exertion'
    });

    expect(result.tokenNumber).toBe(17);
    expect(result.reportingTime).toBe('10:48');
    expect(result.appointmentId).toBe(45);
    expect(result.appointmentCode).toBe('APT00000045');
    expect(result.status).toBe('BOOKED');
    expect(result.doctorName).toBe('Dr. Rahul Menon');
    expect(result.departmentName).toBe('Cardiology');
    expect(result.patientName).toBe('John Mathew');
    expect(result.patientCode).toBe('PAT000123');
    expect(result.consultationTimings).toBe('10:00 - 13:00');

    expect(insertOutboxEventMock).toHaveBeenCalledWith(
      expect.anything(),
      'appointment.booked',
      '45',
      expect.objectContaining({
        appointmentId: 45,
        appointmentCode: 'APT00000045',
        patientId: 1,
        tokenNumber: 17,
        reportingTime: '10:48'
      })
    );
  });

  it('minutesPerPatient has a minimum of 1 even for a very high daily limit', async () => {
    const future = addDays(todayDateStr(), 3);
    getWeeklyScheduleMock.mockResolvedValue({
      ...DOCTOR_SCHEDULE_BASE,
      dailyLimit: 1000, // window/limit < 1 minute per patient
      timings: [{ dayOfWeek: dayOfWeekNumber(future), startTime: '10:00', endTime: '10:10' }]
    });
    upsertAndLockCounterMock.mockResolvedValue(9); // token 10
    existsForPatientDoctorDateMock.mockResolvedValue(false);

    const result = await bookAppointment({
      patientId: 1,
      doctorId: 3,
      appointmentDate: future,
      reason: null
    });

    // minutesPerPatient = max(1, floor(10/1000)) = 1; reporting = 10:00 + 9*1 = 10:09
    expect(result.reportingTime).toBe('10:09');
  });

  it('maps a unique-violation on uq_apt_token to APT_DOCTOR_FULLY_BOOKED as a safety net', async () => {
    const future = addDays(todayDateStr(), 3);
    getWeeklyScheduleMock.mockResolvedValue({
      ...DOCTOR_SCHEDULE_BASE,
      timings: [{ dayOfWeek: dayOfWeekNumber(future), startTime: '10:00', endTime: '13:00' }]
    });
    upsertAndLockCounterMock.mockResolvedValue(10);
    existsForPatientDoctorDateMock.mockResolvedValue(false);
    const pgError = Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'uq_apt_token' });
    insertAppointmentMock.mockRejectedValue(pgError);

    await expect(
      bookAppointment({ patientId: 1, doctorId: 3, appointmentDate: future, reason: null })
    ).rejects.toMatchObject({ code: 'APT_DOCTOR_FULLY_BOOKED', status: 409 });
  });

  it('maps a unique-violation on uq_apt_patient to APT_ALREADY_BOOKED as a safety net', async () => {
    const future = addDays(todayDateStr(), 3);
    getWeeklyScheduleMock.mockResolvedValue({
      ...DOCTOR_SCHEDULE_BASE,
      timings: [{ dayOfWeek: dayOfWeekNumber(future), startTime: '10:00', endTime: '13:00' }]
    });
    upsertAndLockCounterMock.mockResolvedValue(10);
    existsForPatientDoctorDateMock.mockResolvedValue(false);
    const pgError = Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'uq_apt_patient' });
    insertAppointmentMock.mockRejectedValue(pgError);

    await expect(
      bookAppointment({ patientId: 1, doctorId: 3, appointmentDate: future, reason: null })
    ).rejects.toMatchObject({ code: 'APT_ALREADY_BOOKED', status: 409 });
  });

  it('calls doctor-service before user-service, and both before the transaction', async () => {
    const future = addDays(todayDateStr(), 3);
    upsertAndLockCounterMock.mockResolvedValue(0);

    const callOrder: string[] = [];
    getWeeklyScheduleMock.mockImplementation(async () => {
      callOrder.push('doctor-service');
      return { ...DOCTOR_SCHEDULE_BASE, timings: [{ dayOfWeek: dayOfWeekNumber(future), startTime: '10:00', endTime: '13:00' }] };
    });
    getPatientMock.mockImplementation(async () => {
      callOrder.push('user-service');
      return PATIENT;
    });
    withTransactionMock.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => {
      callOrder.push('transaction');
      return fn(mockFakeClient());
    });

    await bookAppointment({ patientId: 1, doctorId: 3, appointmentDate: future, reason: null });

    expect(callOrder).toEqual(['doctor-service', 'user-service', 'transaction']);
  });
});
