import { NotificationRepository } from '../repositories/notificationRepository';
import { AppointmentBookedPayload, KafkaEnvelope } from './types';
import { BOOKING_CONFIRMED_TITLE, renderBookingConfirmedMessage } from './messageTemplate';

/**
 * Handles one `appointment.booked` envelope.
 *
 * NTF-R1: insert one row — title "Booking successful", templated message, event_id from envelope.
 * NTF-R2: ON CONFLICT (event_id) DO NOTHING — 0 rows inserted means already processed; return normally
 *         so the offset is committed (safe to run twice).
 * NTF-R3: any other failure must propagate (throw) so the offset is NOT committed and Kafka redelivers.
 */
export async function handleAppointmentBooked(
  repo: NotificationRepository,
  envelope: KafkaEnvelope<AppointmentBookedPayload>
): Promise<void> {
  const { payload } = envelope;
  const message = renderBookingConfirmedMessage(payload);

  await repo.insertIfNew({
    eventId: envelope.eventId,
    patientId: payload.patientId,
    title: BOOKING_CONFIRMED_TITLE,
    message,
    appointmentId: payload.appointmentId
  });
  // Whether a row was inserted or the conflict was hit, this resolves without throwing,
  // which is correct for both the first delivery and a redelivery (NTF-R2).
  // Any error thrown by repo.insertIfNew (DB down, constraint violation other than the
  // unique event_id, etc.) propagates to the caller untouched (NTF-R3).
}
