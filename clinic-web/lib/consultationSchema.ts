import { z } from "zod";

// Client-side mirrors of DRC-R7, DRC-R8, DRC-R9 (SVC-05 §4.2) for fast feedback;
// the server re-validates authoritatively.

const dosagePatternRegex = /^[0-9]-[0-9]-[0-9]$/;

export const prescriptionItemSchema = z
  .object({
    medicineName: z.string().min(1, "Medicine name is required"),
    strength: z.string().optional(),
    dosagePattern: z
      .string()
      .regex(dosagePatternRegex, "Use the pattern d-d-d, e.g. 1-0-1"),
    timing: z.enum(["BEFORE_FOOD", "AFTER_FOOD", "BEDTIME", "AS_NEEDED"]),
    durationDays: z.coerce
      .number({ invalid_type_error: "Duration is required" })
      .int()
      .min(1, "Duration must be 1-365 days")
      .max(365, "Duration must be 1-365 days"),
    instructions: z.string().optional(),
  })
  .refine((item) => item.timing === "AS_NEEDED" || item.dosagePattern !== "0-0-0", {
    message: "Dosage 0-0-0 is only allowed for 'As needed' timing",
    path: ["dosagePattern"],
  });

const optionalNumberInRange = (min: number, max: number, message: string) =>
  z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.coerce.number().min(min, message).max(max, message).optional()
  );

export const consultationFormSchema = z.object({
  chiefComplaint: z.string().optional(),
  symptoms: z.string().optional(),
  temperatureC: optionalNumberInRange(30, 45, "Temperature must be 30-45 °C"),
  pulseBpm: optionalNumberInRange(20, 250, "Pulse must be 20-250 bpm"),
  bpSystolic: optionalNumberInRange(50, 260, "Systolic BP must be 50-260"),
  bpDiastolic: optionalNumberInRange(30, 160, "Diastolic BP must be 30-160"),
  weightKg: optionalNumberInRange(0.5, 350, "Weight must be 0.5-350 kg"),
  diagnosis: z.string().optional(),
  doctorNotes: z.string().optional(),
  advice: z.string().optional(),
  followUpDate: z.string().optional(),
  prescription: z.array(prescriptionItemSchema).max(20, "Maximum 20 medicines"),
});

export type ConsultationFormValues = z.infer<typeof consultationFormSchema>;

export function validateFollowUpDate(followUpDate: string | undefined): string | null {
  if (!followUpDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const chosen = new Date(followUpDate);
  if (chosen <= today) {
    return "Follow-up date must be after today";
  }
  return null;
}
