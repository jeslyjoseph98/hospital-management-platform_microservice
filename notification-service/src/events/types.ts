export interface KafkaEnvelope<T> {
  eventId: string;
  eventType: string;
  occurredAt: string;
  payload: T;
}

export interface AppointmentBookedPayload {
  appointmentId: number;
  appointmentCode: string;
  patientId: number;
  doctorName: string;
  departmentName: string;
  appointmentDate: string; // date-only, e.g. 2026-09-28
  tokenNumber: number;
  reportingTime: string; // e.g. 10:48 or 10:48:00
}
