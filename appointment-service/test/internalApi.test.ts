import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const getInternalAppointmentMock = vi.fn();
const checkExistsMock = vi.fn();
const getFutureCountsMock = vi.fn();

vi.mock('../src/services/appointmentQueryService', () => ({
  getInternalAppointment: (...args: unknown[]) => getInternalAppointmentMock(...args),
  checkExists: (...args: unknown[]) => checkExistsMock(...args),
  getFutureCounts: (...args: unknown[]) => getFutureCountsMock(...args)
}));

import { createApp } from '../src/app';

const app = createApp();

describe('internal routes — literal paths must win over the /:id wildcard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /internal/appointments/exists is NOT captured by /:id', async () => {
    checkExistsMock.mockResolvedValue(true);
    const res = await request(app).get('/internal/appointments/exists?doctorId=3&patientId=5');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ exists: true });
    expect(checkExistsMock).toHaveBeenCalledWith(3, 5);
    expect(getInternalAppointmentMock).not.toHaveBeenCalled();
  });

  it('GET /internal/appointments/future-counts is NOT captured by /:id', async () => {
    getFutureCountsMock.mockResolvedValue([{ date: '2026-10-07', dayOfWeek: 3, count: 14 }]);
    const res = await request(app).get('/internal/appointments/future-counts?doctorId=3');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ date: '2026-10-07', dayOfWeek: 3, count: 14 }]);
    expect(getFutureCountsMock).toHaveBeenCalledWith(3);
    expect(getInternalAppointmentMock).not.toHaveBeenCalled();
  });

  it('GET /internal/appointments/{id} still resolves numeric ids', async () => {
    getInternalAppointmentMock.mockResolvedValue({ appointmentId: 45 });
    const res = await request(app).get('/internal/appointments/45');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ appointmentId: 45 });
    expect(getInternalAppointmentMock).toHaveBeenCalledWith(45);
  });
});
