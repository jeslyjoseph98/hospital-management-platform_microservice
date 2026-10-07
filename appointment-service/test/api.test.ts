import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const computeAvailabilityMock = vi.fn();
const bookAppointmentMock = vi.fn();
const listMyAppointmentsMock = vi.fn();
const getMyAppointmentByIdMock = vi.fn();
const getDoctorTodayListMock = vi.fn();
const getAdminBookingsMock = vi.fn();

vi.mock('../src/services/availabilityService', () => ({
  computeAvailability: (...args: unknown[]) => computeAvailabilityMock(...args)
}));
vi.mock('../src/services/bookingService', () => ({
  bookAppointment: (...args: unknown[]) => bookAppointmentMock(...args)
}));
vi.mock('../src/services/appointmentQueryService', () => ({
  listMyAppointments: (...args: unknown[]) => listMyAppointmentsMock(...args),
  getMyAppointmentById: (...args: unknown[]) => getMyAppointmentByIdMock(...args),
  getDoctorTodayList: (...args: unknown[]) => getDoctorTodayListMock(...args),
  getAdminBookings: (...args: unknown[]) => getAdminBookingsMock(...args)
}));

import { createApp } from '../src/app';
import { BusinessError } from '../src/utils/BusinessError';

const app = createApp();

describe('API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /health returns UP', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
  });

  it('rejects a non-PATIENT role on availability with 403 AUTH_FORBIDDEN', async () => {
    const res = await request(app)
      .get('/api/v1/doctors/3/availability')
      .set('X-User-Role', 'DOCTOR');
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.errorCode).toBe('AUTH_FORBIDDEN');
  });

  it('GET /api/v1/doctors/:id/availability returns the standard success envelope', async () => {
    computeAvailabilityMock.mockResolvedValue({ doctorId: 3, doctorName: 'Dr. X', dailyLimit: 50, dates: [] });
    const res = await request(app)
      .get('/api/v1/doctors/3/availability')
      .set('X-User-Role', 'PATIENT');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { doctorId: 3 } });
  });

  it('POST /api/v1/appointments validates the body (VALIDATION_FAILED, 400)', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('X-User-Role', 'PATIENT')
      .set('X-Patient-Id', '123')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errorCode).toBe('VALIDATION_FAILED');
    expect(Array.isArray(res.body.fieldErrors)).toBe(true);
    expect(res.body.fieldErrors.length).toBeGreaterThan(0);
  });

  it('POST /api/v1/appointments returns 201 with Booking successful message on success', async () => {
    bookAppointmentMock.mockResolvedValue({
      appointmentId: 45,
      appointmentCode: 'APT00000045',
      tokenNumber: 17,
      reportingTime: '10:48',
      appointmentDate: '2026-09-28',
      doctorName: 'Dr. Rahul Menon',
      departmentName: 'Cardiology',
      consultationTimings: '10:00 - 13:00',
      patientName: 'John Mathew',
      patientCode: 'PAT000123',
      status: 'BOOKED'
    });

    const res = await request(app)
      .post('/api/v1/appointments')
      .set('X-User-Role', 'PATIENT')
      .set('X-Patient-Id', '123')
      .send({ doctorId: 3, appointmentDate: '2026-09-28', reason: 'Chest pain on exertion' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Booking successful');
    expect(res.body.data.tokenNumber).toBe(17);
    expect(bookAppointmentMock).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 123, doctorId: 3, appointmentDate: '2026-09-28' }),
      undefined
    );
  });

  it('propagates a BusinessError from the service layer as the standard error envelope', async () => {
    bookAppointmentMock.mockRejectedValue(
      new BusinessError('APT_DOCTOR_FULLY_BOOKED', 409, 'Dr. Rahul Menon is fully booked on 28-09-2026. Please choose another date.')
    );

    const res = await request(app)
      .post('/api/v1/appointments')
      .set('X-User-Role', 'PATIENT')
      .set('X-Patient-Id', '123')
      .send({ doctorId: 3, appointmentDate: '2026-09-28' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, errorCode: 'APT_DOCTOR_FULLY_BOOKED', data: null });
  });

  it('GET /api/v1/doctor/appointments/today requires DOCTOR role and doctorId header', async () => {
    getDoctorTodayListMock.mockResolvedValue({ date: '2026-09-28', total: 0, completed: 0, pending: 0, appointments: [] });
    const res = await request(app)
      .get('/api/v1/doctor/appointments/today')
      .set('X-User-Role', 'DOCTOR')
      .set('X-Doctor-Id', '3');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/v1/admin/appointments requires doctorId and date query params', async () => {
    const res = await request(app)
      .get('/api/v1/admin/appointments')
      .set('X-User-Role', 'ADMIN');
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('VALIDATION_FAILED');
  });

  it('unknown route returns 404', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
  });
});
