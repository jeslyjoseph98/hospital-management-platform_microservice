import { api } from './client';
import { AdminBookingsView } from '../types/domain';

export function getAdminBookings(doctorId: number, date: string) {
  return api.get<AdminBookingsView>(`/admin/appointments?doctorId=${doctorId}&date=${date}`);
}
