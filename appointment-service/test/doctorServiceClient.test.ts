import { beforeEach, describe, expect, it, vi } from 'vitest';

const syncGetMock = vi.fn();
vi.mock('../src/clients/httpClient', () => ({
  syncGet: (...args: unknown[]) => syncGetMock(...args)
}));

import { getWeeklySchedule } from '../src/clients/doctorServiceClient';

describe('doctorServiceClient.getWeeklySchedule', () => {
  beforeEach(() => {
    syncGetMock.mockReset();
  });

  it('APT-R3: maps a null (404) result to DOC_NOT_FOUND', async () => {
    syncGetMock.mockResolvedValue(null);
    await expect(getWeeklySchedule(999)).rejects.toMatchObject({ code: 'DOC_NOT_FOUND', status: 404 });
  });

  it('APT-R3: maps active=false to DOC_NOT_FOUND', async () => {
    syncGetMock.mockResolvedValue({
      doctorId: 3,
      fullName: 'Dr. X',
      departmentName: 'Cardiology',
      active: false,
      dailyLimit: 50,
      timings: []
    });
    await expect(getWeeklySchedule(3)).rejects.toMatchObject({ code: 'DOC_NOT_FOUND', status: 404 });
  });

  it('returns the schedule when active', async () => {
    const schedule = {
      doctorId: 3,
      fullName: 'Dr. X',
      departmentName: 'Cardiology',
      active: true,
      dailyLimit: 50,
      timings: []
    };
    syncGetMock.mockResolvedValue(schedule);
    await expect(getWeeklySchedule(3)).resolves.toEqual(schedule);
  });
});
