import { config } from '../config/env';
import { BusinessError } from '../utils/BusinessError';
import { syncGet } from './httpClient';

export interface PatientDetails {
  patientId: number;
  patientCode: string;
  name: string;
  phone: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: string;
  address: string;
}

/**
 * GET /internal/patients/{id}
 * Used to snapshot patient data onto the appointment at booking time (MS-R2).
 * A 404 here is unexpected (the patient id comes from a trusted gateway header for an
 * authenticated patient) and is treated as SERVICE_UNAVAILABLE along with any other failure.
 */
export async function getPatient(patientId: number, requestId?: string): Promise<PatientDetails> {
  const url = `${config.userServiceUrl}/internal/patients/${patientId}`;
  const result = await syncGet<PatientDetails>(url, { requestId, notFoundReturnsNull: false });
  if (result === null) {
    throw new BusinessError('SERVICE_UNAVAILABLE', 503, 'A dependent service is unavailable.');
  }
  return result;
}
