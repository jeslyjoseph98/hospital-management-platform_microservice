import { api } from './client';
import { Department, DepartmentFormInput } from '../types/domain';

export function listDepartments() {
  return api.get<Department[]>('/admin/departments');
}

export function createDepartment(input: DepartmentFormInput) {
  return api.post<Department>('/admin/departments', input);
}

export function updateDepartment(id: number, input: DepartmentFormInput) {
  return api.put<Department>(`/admin/departments/${id}`, input);
}

export function setDepartmentStatus(id: number, active: boolean) {
  return api.patch<Department>(`/admin/departments/${id}/status`, { active });
}
