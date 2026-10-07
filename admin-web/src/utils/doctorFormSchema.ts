import { z } from 'zod';

// Client-side checks per SVC-07A §7: required fields, phone 10 digits starting 6-9,
// end time after start time (validated separately by the timings editor).
export const doctorProfileSchema = z.object({
  departmentId: z.string().min(1, 'Department is required'),
  fullName: z.string().min(1, 'Full name is required'),
  qualification: z.string().min(1, 'Qualification is required'),
  specialization: z.string().min(1, 'Specialization is required'),
  registrationNumber: z.string().min(1, 'Medical registration number is required'),
  experienceYears: z
    .string()
    .min(1, 'Experience is required')
    .refine((v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 0 && n <= 70;
    }, 'Experience must be between 0 and 70'),
  phone: z
    .string()
    .min(1, 'Phone is required')
    .regex(/^[6-9]\d{9}$/, 'Phone must be 10 digits starting with 6-9'),
  email: z.union([z.string().email('Enter a valid email'), z.literal('')]).optional(),
  about: z.string().optional(),
  consultationFee: z
    .string()
    .min(1, 'Consultation fee is required')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, 'Fee must be 0 or more'),
  dailyLimit: z
    .string()
    .min(1, 'Daily limit is required')
    .refine((v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 1 && n <= 200;
    }, 'Daily limit must be between 1 and 200'),
});

export type DoctorProfileSchema = z.infer<typeof doctorProfileSchema>;
