import { api } from './client';
import { DoctorDetail, DoctorListItem, DoctorProfileFormInput, DoctorTiming, Paged } from '../types/domain';

export interface DoctorFilters {
  departmentId?: number;
  name?: string;
  active?: boolean;
  page?: number;
  size?: number;
}

function buildQuery<T extends object>(params: T): string {
  const search = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function listDoctors(filters: DoctorFilters) {
  return api.get<Paged<DoctorListItem>>(`/admin/doctors${buildQuery(filters)}`);
}

export function getDoctor(id: number) {
  return api.get<DoctorDetail>(`/admin/doctors/${id}`);
}

export interface CreateDoctorInput extends DoctorProfileFormInput {
  timings: DoctorTiming[];
}

export function createDoctor(input: CreateDoctorInput) {
  return api.post<DoctorDetail>('/admin/doctors', input);
}

export function updateDoctor(id: number, input: DoctorProfileFormInput) {
  return api.put<DoctorDetail>(`/admin/doctors/${id}`, input);
}

export function updateDoctorTimings(id: number, timings: DoctorTiming[]) {
  return api.put<DoctorDetail>(`/admin/doctors/${id}/timings`, { timings });
}

export function setDoctorStatus(id: number, active: boolean) {
  return api.patch<DoctorDetail>(`/admin/doctors/${id}/status`, { active });
}
