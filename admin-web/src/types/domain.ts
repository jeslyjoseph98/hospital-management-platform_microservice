// Domain types mirrored from SVC-02, SVC-03, SVC-04 specs.

export type Role = 'PATIENT' | 'ADMIN' | 'DOCTOR' | 'PHARMACIST';

export interface LoggedInUser {
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
  user: LoggedInUser;
}

export interface RegisterResponse {
  userId: number;
  role: Role;
  patientCode: string | null;
}

// ---- Departments (SVC-03) ----

export interface Department {
  id: number;
  deptName: string;
  description: string | null;
  isActive: boolean;
  activeDoctorCount?: number;
}

export interface DepartmentFormInput {
  deptName: string;
  description?: string;
}

// ---- Doctors (SVC-03) ----

export interface DoctorTiming {
  dayOfWeek: number; // 1 = Monday ... 7 = Sunday
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

export interface DoctorListItem {
  id: number;
  fullName: string;
  departmentId: number;
  departmentName: string;
  specialization: string;
  consultationFee: number;
  dailyLimit: number;
  timings: DoctorTiming[];
  loginRegistered: boolean;
  isActive: boolean;
}

export interface DoctorDetail {
  id: number;
  departmentId: number;
  departmentName: string;
  fullName: string;
  qualification: string;
  specialization: string;
  registrationNumber: string;
  experienceYears: number;
  phone: string;
  email: string | null;
  about: string | null;
  consultationFee: number;
  dailyLimit: number;
  loginRegistered: boolean;
  isActive: boolean;
  timings: DoctorTiming[];
}

export interface DoctorProfileFormInput {
  departmentId: number;
  fullName: string;
  qualification: string;
  specialization: string;
  registrationNumber: string;
  experienceYears: number;
  phone: string;
  email?: string;
  about?: string;
  consultationFee: number;
  dailyLimit: number;
}

export interface Paged<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

// ---- Bookings (SVC-04) ----

export type AppointmentStatus = 'BOOKED' | 'COMPLETED' | 'CANCELLED' | string;

export interface BookingToken {
  tokenNumber: number;
  patientName: string;
  patientCode: string;
  reportingTime: string;
  status: AppointmentStatus;
}

export interface AdminBookingsView {
  booked: number;
  tokens: BookingToken[];
}
