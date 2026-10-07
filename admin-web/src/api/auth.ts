import { api } from './client';
import { LoggedInUser, LoginResponse, RegisterResponse } from '../types/domain';

export interface RegisterAdminInput {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
  adminCode: string;
}

export interface LoginInput {
  phone: string;
  password: string;
}

export function registerAdmin(input: RegisterAdminInput) {
  return api.post<RegisterResponse>('/auth/register', { role: 'ADMIN', ...input }, { skipAuth: true });
}

export function loginAdmin(input: LoginInput) {
  return api.post<LoginResponse>('/auth/login', { role: 'ADMIN', ...input }, { skipAuth: true });
}

export function fetchMe(options?: { skipUnauthorizedRedirect?: boolean }) {
  return api.get<LoggedInUser>('/auth/me', { skipUnauthorizedRedirect: options?.skipUnauthorizedRedirect });
}
