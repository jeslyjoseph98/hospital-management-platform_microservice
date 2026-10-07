import * as appointmentRepository from '../repositories/appointmentRepository';
import { AppointmentRow } from '../repositories/appointmentRepository';
import { BusinessError } from '../utils/BusinessError';
import { ageFromDob, todayDateStr } from '../utils/datetime';

function toDateStr(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function toTimeStr(value: string): string {
  // pg TIME columns come back as 'HH:MM:SS'; trim to 'HH:MM'.
  return value.length >= 5 ? value.slice(0, 5) : value;
}

export interface BookingSlip {
  appointmentId: number;
  appointmentCode: string | null;
  tokenNumber: number;
  reportingTime: string;
  appointmentDate: string;
  doctorName: string;
  departmentName: string;
  consultationTimings: string;
  patientName: string;
  patientCode: string;
  reason: string | null;
  status: 'BOOKED' | 'COMPLETED';
}

function toBookingSlip(row: AppointmentRow): BookingSlip {
  return {
    appointmentId: row.id,
    appointmentCode: row.appointment_code,
    tokenNumber: row.token_number,
    reportingTime: toTimeStr(row.reporting_time),
    appointmentDate: toDateStr(row.appointment_date),
    doctorName: row.doctor_name,
    departmentName: row.department_name,
    consultationTimings: `${toTimeStr(row.consultation_start)} - ${toTimeStr(row.consultation_end)}`,
    patientName: row.patient_name,
    patientCode: row.patient_code,
    reason: row.reason,
    status: row.status
  };
}

export async function listMyAppointments(patientId: number, upcoming: boolean): Promise<BookingSlip[]> {
  const rows = await appointmentRepository.findMyAppointments(patientId, upcoming, todayDateStr());
  return rows.map(toBookingSlip);
}

/** APT-R11: patient sees only own appointments; otherwise 404 APT_NOT_FOUND. */
export async function getMyAppointmentById(id: number, patientId: number): Promise<BookingSlip> {
  const row = await appointmentRepository.findByIdForPatient(id, patientId);
  if (!row) {
    throw new BusinessError('APT_NOT_FOUND', 404, 'Appointment not found.');
  }
  return toBookingSlip(row);
}

export interface TodayListRow {
  appointmentId: number;
  tokenNumber: number;
  reportingTime: string;
  patientId: number;
  patientName: string;
  patientCode: string;
  age: number;
  gender: string;
  status: 'BOOKED' | 'COMPLETED';
}

export interface TodayListResult {
  date: string;
  total: number;
  completed: number;
  pending: number;
  appointments: TodayListRow[];
}

export async function getDoctorTodayList(doctorId: number): Promise<TodayListResult> {
  const today = todayDateStr();
  const rows = await appointmentRepository.findTodayForDoctor(doctorId, today);

  const appointments: TodayListRow[] = rows.map((row) => ({
    appointmentId: row.id,
    tokenNumber: row.token_number,
    reportingTime: toTimeStr(row.reporting_time),
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientCode: row.patient_code,
    age: ageFromDob(toDateStr(row.patient_dob)),
    gender: row.patient_gender,
    status: row.status
  }));

  const completed = appointments.filter((a) => a.status === 'COMPLETED').length;
  const pending = appointments.filter((a) => a.status === 'BOOKED').length;

  return {
    date: today,
    total: appointments.length,
    completed,
    pending,
    appointments
  };
}

export interface AdminBookingRow {
  appointmentId: number;
  tokenNumber: number;
  patientName: string;
  patientCode: string;
  reportingTime: string;
  status: 'BOOKED' | 'COMPLETED';
}

export interface AdminBookingsResult {
  doctorId: number;
  date: string;
  booked: number;
  appointments: AdminBookingRow[];
}

export async function getAdminBookings(doctorId: number, date: string): Promise<AdminBookingsResult> {
  const rows = await appointmentRepository.findForAdmin(doctorId, date);
  const appointments: AdminBookingRow[] = rows.map((row) => ({
    appointmentId: row.id,
    tokenNumber: row.token_number,
    patientName: row.patient_name,
    patientCode: row.patient_code,
    reportingTime: toTimeStr(row.reporting_time),
    status: row.status
  }));
  return {
    doctorId,
    date,
    booked: appointments.length,
    appointments
  };
}

export interface InternalAppointmentDetail {
  appointmentId: number;
  appointmentCode: string | null;
  patientId: number;
  doctorId: number;
  appointmentDate: string;
  tokenNumber: number;
  reportingTime: string;
  reason: string | null;
  status: 'BOOKED' | 'COMPLETED';
  patientName: string;
  patientCode: string;
  patientGender: string;
  patientDob: string;
  doctorName: string;
  departmentName: string;
  consultationStart: string;
  consultationEnd: string;
}

export async function getInternalAppointment(id: number): Promise<InternalAppointmentDetail> {
  const row = await appointmentRepository.findById(id);
  if (!row) {
    throw new BusinessError('APT_NOT_FOUND', 404, 'Appointment not found.');
  }
  return {
    appointmentId: row.id,
    appointmentCode: row.appointment_code,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    appointmentDate: toDateStr(row.appointment_date),
    tokenNumber: row.token_number,
    reportingTime: toTimeStr(row.reporting_time),
    reason: row.reason,
    status: row.status,
    patientName: row.patient_name,
    patientCode: row.patient_code,
    patientGender: row.patient_gender,
    patientDob: toDateStr(row.patient_dob),
    doctorName: row.doctor_name,
    departmentName: row.department_name,
    consultationStart: toTimeStr(row.consultation_start),
    consultationEnd: toTimeStr(row.consultation_end)
  };
}

export async function checkExists(doctorId: number, patientId: number): Promise<boolean> {
  return appointmentRepository.existsForDoctorPatient(doctorId, patientId);
}

export async function getFutureCounts(doctorId: number) {
  return appointmentRepository.getFutureCounts(doctorId, todayDateStr());
}
