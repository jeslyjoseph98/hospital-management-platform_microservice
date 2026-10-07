import { beforeEach, describe, expect, it, vi } from 'vitest';

const completeAppointmentMock = vi.fn();
vi.mock('../src/repositories/appointmentRepository', () => ({
  completeAppointment: (...args: unknown[]) => completeAppointmentMock(...args)
}));

import { handleConsultationCompleted } from '../src/services/consultationCompletedService';

describe('handleConsultationCompleted', () => {
  beforeEach(() => {
    completeAppointmentMock.mockReset();
  });

  it('calls completeAppointment with the appointmentId from the payload', async () => {
    completeAppointmentMock.mockResolvedValue(undefined);
    await handleConsultationCompleted({ consultationId: 'abc123', appointmentId: 45 });
    expect(completeAppointmentMock).toHaveBeenCalledWith(45);
  });

  it('is safe to call twice (idempotent at the repository/SQL level via WHERE status = BOOKED)', async () => {
    completeAppointmentMock.mockResolvedValue(undefined);
    await handleConsultationCompleted({ consultationId: 'abc123', appointmentId: 45 });
    await handleConsultationCompleted({ consultationId: 'abc123', appointmentId: 45 });
    expect(completeAppointmentMock).toHaveBeenCalledTimes(2);
    expect(completeAppointmentMock).toHaveBeenNthCalledWith(1, 45);
    expect(completeAppointmentMock).toHaveBeenNthCalledWith(2, 45);
  });
});
