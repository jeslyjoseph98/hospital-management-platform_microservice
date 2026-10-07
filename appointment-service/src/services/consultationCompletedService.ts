import * as appointmentRepository from '../repositories/appointmentRepository';

export interface ConsultationCompletedPayload {
  consultationId: string;
  appointmentId: number;
}

/**
 * Consumes consultation.completed. Idempotent: the WHERE status = 'BOOKED' guard means
 * running this twice (OB-R3) has no additional effect the second time.
 */
export async function handleConsultationCompleted(payload: ConsultationCompletedPayload): Promise<void> {
  await appointmentRepository.completeAppointment(payload.appointmentId);
}
