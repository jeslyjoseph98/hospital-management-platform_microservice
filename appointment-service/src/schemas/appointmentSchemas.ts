import { z } from 'zod';

export const bookAppointmentSchema = z.object({
  doctorId: z.number({ required_error: 'doctorId is required', invalid_type_error: 'doctorId must be a number' }).int().positive(),
  appointmentDate: z
    .string({ required_error: 'appointmentDate is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'appointmentDate must be in YYYY-MM-DD format'),
  reason: z.string().max(300, 'reason must be at most 300 characters').optional().nullable()
});

export type BookAppointmentBody = z.infer<typeof bookAppointmentSchema>;
