"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FieldErrorText } from "@/components/FieldErrorText";
import { useAuth } from "@/context/AuthContext";
import { useApiError } from "@/hooks/useApiError";
import { apiFetch } from "@/lib/apiClient";
import { toFieldErrorMap } from "@/lib/fieldErrors";
import type { LoginResponse } from "@/lib/types";

const loginSchema = z.object({
  role: z.enum(["DOCTOR", "PHARMACIST"], { required_error: "Role is required" }),
  phone: z.string().min(1, "Phone is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { handle } = useApiError();
  const [submitting, setSubmitting] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { role: "DOCTOR", phone: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setSubmitting(true);
    setServerFieldErrors({});
    try {
      const data = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
        skipAuth: true,
      });
      login(data.accessToken, data.user);
      if (data.user.role === "DOCTOR") {
        router.push("/doctor/today");
      } else if (data.user.role === "PHARMACIST") {
        router.push("/pharmacy/prescriptions");
      } else {
        router.push("/login");
      }
    } catch (err) {
      const fieldErrs = handle(err);
      setServerFieldErrors(toFieldErrorMap(fieldErrs));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="form-card">
      <h1>Clinic Login</h1>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="field">
          <label htmlFor="role">Login as</label>
          <select id="role" {...register("role")}>
            <option value="DOCTOR">Doctor</option>
            <option value="PHARMACIST">Pharmacist</option>
          </select>
          <FieldErrorText message={errors.role?.message} />
        </div>

        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" type="text" inputMode="numeric" {...register("phone")} />
          <FieldErrorText message={errors.phone?.message ?? serverFieldErrors.phone} />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" {...register("password")} />
          <FieldErrorText message={errors.password?.message ?? serverFieldErrors.password} />
        </div>

        <button type="submit" className="btn" style={{ width: "100%" }} disabled={submitting}>
          {submitting ? "Logging in..." : "Login"}
        </button>
      </form>
      <div className="form-footer">
        Don&apos;t have an account? <Link href="/register">Register</Link>
      </div>
    </div>
  );
}
