import { describe, expect, it, vi, beforeEach } from 'vitest';
import { handleAppointmentBooked } from '../src/events/appointmentBookedHandler';
import { NotificationRepository } from '../src/repositories/notificationRepository';
import { AppointmentBookedPayload, KafkaEnvelope } from '../src/events/types';
import { renderBookingConfirmedMessage } from '../src/events/messageTemplate';

function buildEnvelope(
  overrides: Partial<AppointmentBookedPayload> = {}
): KafkaEnvelope<AppointmentBookedPayload> {
  return {
    eventId: '6f1c2a0e-4b7d-4e55-9c1a-2f7b1d9e8a10',
    eventType: 'appointment.booked',
    occurredAt: '2026-09-28T10:15:30Z',
    payload: {
      appointmentId: 55,
      appointmentCode: 'APT-55',
      patientId: 42,
      doctorName: 'Dr. Rahul Menon',
      departmentName: 'Cardiology',
      appointmentDate: '2026-09-28',
      tokenNumber: 17,
      reportingTime: '10:48',
      ...overrides
    }
  };
}

describe('message template rendering', () => {
  it('renders the exact template from SVC-06 §4', () => {
    const msg = renderBookingConfirmedMessage(buildEnvelope().payload);
    expect(msg).toBe(
      'Your appointment with Dr. Rahul Menon (Cardiology) on 28-09-2026 is confirmed. Token No: 17. Please report by 10:48 AM.'
    );
  });

  it('formats midnight and noon correctly (12-hour clock edge cases)', () => {
    expect(renderBookingConfirmedMessage(buildEnvelope({ reportingTime: '00:05' }).payload)).toContain(
      '12:05 AM'
    );
    expect(renderBookingConfirmedMessage(buildEnvelope({ reportingTime: '12:00' }).payload)).toContain(
      '12:00 PM'
    );
    expect(renderBookingConfirmedMessage(buildEnvelope({ reportingTime: '23:59' }).payload)).toContain(
      '11:59 PM'
    );
  });
});

describe('handleAppointmentBooked (NTF-R1..R3)', () => {
  let repo: NotificationRepository;

  beforeEach(() => {
    repo = { insertIfNew: vi.fn() } as unknown as NotificationRepository;
  });

  it('NTF-R1: inserts with title "Booking successful", rendered message, and envelope fields', async () => {
    (repo.insertIfNew as any).mockResolvedValue(true);
    const envelope = buildEnvelope();

    await handleAppointmentBooked(repo, envelope);

    expect(repo.insertIfNew).toHaveBeenCalledWith({
      eventId: envelope.eventId,
      patientId: 42,
      title: 'Booking successful',
      message:
        'Your appointment with Dr. Rahul Menon (Cardiology) on 28-09-2026 is confirmed. Token No: 17. Please report by 10:48 AM.',
      appointmentId: 55
    });
  });

  it('NTF-R2: resolves without throwing when the insert is a duplicate (0 rows), so the offset commits', async () => {
    (repo.insertIfNew as any).mockResolvedValue(false);
    await expect(handleAppointmentBooked(repo, buildEnvelope())).resolves.toBeUndefined();
  });

  it('NTF-R2: resolves without throwing on a fresh insert too', async () => {
    (repo.insertIfNew as any).mockResolvedValue(true);
    await expect(handleAppointmentBooked(repo, buildEnvelope())).resolves.toBeUndefined();
  });

  it('NTF-R3: rethrows when the repository insert fails, so the kafkajs offset is not committed', async () => {
    const dbError = new Error('connection refused');
    (repo.insertIfNew as any).mockRejectedValue(dbError);

    await expect(handleAppointmentBooked(repo, buildEnvelope())).rejects.toThrow('connection refused');
  });
});
