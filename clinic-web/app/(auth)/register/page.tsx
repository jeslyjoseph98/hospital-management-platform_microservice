"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FieldErrorText } from "@/components/FieldErrorText";
import { useApiError } from "@/hooks/useApiError";
import { apiFetch } from "@/lib/apiClient";
import { toFieldErrorMap } from "@/lib/fieldErrors";
import type { RegisterResponse } from "@/lib/types";

const registerSchema = z
  .object({
    role: z.enum(["DOCTOR", "PHARMACIST"], { required_error: "Role is required" }),
    fullName: z.string().min(1, "Full name is required"),
    phone: z.string().min(1, "Phone is required"),
    email: z.string().email("Enter a valid email").optional().or(z.literal("")),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    registrationNumber: z.string().optional(),
    staffCode: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => (data.role === "DOCTOR" ? !!data.registrationNumber?.trim() : true), {
    message: "Medical registration number is required",
    path: ["registrationNumber"],
  })
  .refine((data) => (data.role === "PHARMACIST" ? !!data.staffCode?.trim() : true), {
    message: "Staff registration code is required",
    path: ["staffCode"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { handle } = useApiError();
  const [submitting, setSubmitting] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "DOCTOR",
      fullName: "",
      phone: "",
      email: "",
      password: "",
      confirmPassword: "",
      registrationNumber: "",
      staffCode: "",
    },
  });

  const role = watch("role");

  async function onSubmit(values: RegisterFormValues) {
    setSubmitting(true);
    setServerFieldErrors({});
    setSuccessMessage(null);
    try {
      const payload: Record<string, unknown> = {
        role: values.role,
        fullName: values.fullName,
        phone: values.phone,
        password: values.password,
      };
      if (values.email) payload.email = values.email;
      if (values.role === "DOCTOR") payload.registrationNumber = values.registrationNumber;
      if (values.role === "PHARMACIST") payload.staffCode = values.staffCode;

      const data = await apiFetch<RegisterResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
        skipAuth: true,
      });
      setSuccessMessage(`Registration successful as ${data.role}. Please log in.`);
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      const fieldErrs = handle(err);
      setServerFieldErrors(toFieldErrorMap(fieldErrs));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="form-card">
      <h1>Clinic Registration</h1>
      {successMessage && <p style={{ color: "var(--color-success)" }}>{successMessage}</p>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="field">
          <label htmlFor="role">Register as</label>
          <select id="role" {...register("role")}>
            <option value="DOCTOR">Doctor</option>
            <option value="PHARMACIST">Pharmacist</option>
          </select>
          <FieldErrorText message={errors.role?.message} />
        </div>

        <div className="field">
          <label htmlFor="fullName">Full name</label>
          <input id="fullName" type="text" {...register("fullName")} />
          <FieldErrorText message={errors.fullName?.message ?? serverFieldErrors.fullName} />
        </div>

        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" type="text" inputMode="numeric" {...register("phone")} />
          <FieldErrorText message={errors.phone?.message ?? serverFieldErrors.phone} />
        </div>

        <div className="field">
          <label htmlFor="email">Email (optional)</label>
          <input id="email" type="email" {...register("email")} />
          <FieldErrorText message={errors.email?.message ?? serverFieldErrors.email} />
        </div>

        {role === "DOCTOR" && (
          <div className="field">
            <label htmlFor="registrationNumber">Medical registration number</label>
            <input id="registrationNumber" type="text" {...register("registrationNumber")} />
            <FieldErrorText
              message={errors.registrationNumber?.message ?? serverFieldErrors.registrationNumber}
            />
          </div>
        )}

        {role === "PHARMACIST" && (
          <div className="field">
            <label htmlFor="staffCode">Staff registration code</label>
            <input id="staffCode" type="text" {...register("staffCode")} />
            <FieldErrorText message={errors.staffCode?.message ?? serverFieldErrors.staffCode} />
          </div>
        )}

        <div className="form-row">
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" {...register("password")} />
            <FieldErrorText message={errors.password?.message ?? serverFieldErrors.password} />
          </div>
          <div className="field">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input id="confirmPassword" type="password" {...register("confirmPassword")} />
            <FieldErrorText message={errors.confirmPassword?.message} />
          </div>
        </div>

        <button type="submit" className="btn" style={{ width: "100%" }} disabled={submitting}>
          {submitting ? "Registering..." : "Register"}
        </button>
      </form>
      <div className="form-footer">
        Already have an account? <Link href="/login">Login</Link>
      </div>
    </div>
  );
}
