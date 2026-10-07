// Shared types for clinic-web, per SVC-00 §7 envelope and SVC-02/04/05 contracts.

export type Role = "PATIENT" | "ADMIN" | "DOCTOR" | "PHARMACIST";

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  errorCode: string;
  message: string;
  fieldErrors: FieldError[];
  data: null;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiError;

// ---- Auth (SVC-02 §6) ----

export interface LoginUser {
  id: number;
  name: string;
  role: Role;
  patientId: number | null;
  patientCode: string | null;
  doctorId: number | null;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: LoginUser;
}

export interface RegisterResponse {
  userId: number;
  role: Role;
  patientCode: string | null;
}

// ---- Doctor today list (SVC-04 §6) ----

export type AppointmentStatus = "BOOKED" | "COMPLETED";

export interface TodayAppointmentRow {
  appointmentId: number;
  tokenNumber: number;
  reportingTime: string; // HH:mm
  patientId: number;
  patientName: string;
  patientCode: string;
  age: number;
  gender: string;
  status: AppointmentStatus;
}

export interface TodayAppointmentsResponse {
  date: string;
  total: number;
  completed: number;
  pending: number;
  appointments: TodayAppointmentRow[];
}

// ---- Consultation (SVC-05) ----

export type ConsultationStatus = "IN_PROGRESS" | "COMPLETED";
export type DispenseStatus = "NOT_REQUIRED" | "PENDING" | "DISPENSED";
export type MedicineTiming = "BEFORE_FOOD" | "AFTER_FOOD" | "BEDTIME" | "AS_NEEDED";

export interface PrescriptionItem {
  medicineName: string;
  strength?: string | null;
  dosagePattern: string; // d-d-d
  timing: MedicineTiming;
  durationDays: number;
  instructions?: string | null;
}

export interface Vitals {
  temperatureC?: number | null;
  pulseBpm?: number | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  weightKg?: number | null;
}

export interface DispenseInfo {
  status: DispenseStatus;
  byUserId: number | null;
  byName: string | null;
  at: string | null;
  remarks: string | null;
}

export interface AppointmentSummary {
  appointmentId: number;
  appointmentCode: string;
  appointmentDate: string;
  tokenNumber: number;
  status: AppointmentStatus;
}

export interface PatientDetails {
  patientId: number;
  patientCode: string;
  name: string;
  age: number;
  gender: string;
  phone?: string | null;
  address?: string | null;
}

export interface HistoryVisit {
  consultationId: string;
  date: string;
  doctorName: string;
  departmentName: string;
  chiefComplaint?: string | null;
  diagnosis?: string | null;
  advice?: string | null;
  doctorNotes?: string | null;
  followUpDate?: string | null;
  prescription: PrescriptionItem[];
  dispenseStatus: DispenseStatus;
}

export interface ConsultationDoc {
  consultationId?: string;
  chiefComplaint?: string | null;
  symptoms?: string | null;
  temperatureC?: number | null;
  pulseBpm?: number | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  weightKg?: number | null;
  diagnosis?: string | null;
  doctorNotes?: string | null;
  advice?: string | null;
  followUpDate?: string | null;
  prescription: PrescriptionItem[];
  status?: ConsultationStatus;
  dispense?: DispenseInfo;
}

export interface DoctorConsultationWorkspace {
  appointment: AppointmentSummary;
  patient: PatientDetails;
  history: HistoryVisit[];
  consultation: ConsultationDoc | null;
}

export interface DoctorPatientHistoryResponse {
  patient: PatientDetails;
  history: HistoryVisit[];
}

// ---- Pharmacy (SVC-05 §7.2/7.3) ----

export interface PendingPrescriptionRow {
  consultationId: string;
  appointmentCode: string;
  tokenNumber: number;
  patientName: string;
  patientCode: string;
  doctorName: string;
  departmentName: string;
  completedAt: string;
  itemCount: number;
  dispenseStatus: DispenseStatus;
}

export interface PrescriptionDetail {
  consultationId: string;
  patientName: string;
  patientCode: string;
  age: number;
  gender: string;
  doctorName: string;
  departmentName: string;
  completedAt: string;
  diagnosis?: string | null;
  followUpDate?: string | null;
  prescription: PrescriptionItem[];
  dispense: DispenseInfo;
}

export interface DispenseResponse {
  dispenseStatus: DispenseStatus;
  dispensedAt: string | null;
  dispensedByName: string | null;
}
