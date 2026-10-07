"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import type { Role } from "@/lib/types";

const HOME_BY_ROLE: Record<Role, string> = {
  DOCTOR: "/doctor/today",
  PHARMACIST: "/pharmacy/prescriptions",
  PATIENT: "/login",
  ADMIN: "/login",
};

interface AuthGuardProps {
  /** The role this route group is reserved for. */
  requiredRole: "DOCTOR" | "PHARMACIST";
  children: ReactNode;
}

/**
 * Route guard for the (doctor) and (pharmacy) route groups.
 * Implements CW-R1..CW-R4 and CW-R7 (session restore handled by AuthContext).
 */
export function AuthGuard({ requiredRole, children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // CW-R1
      router.replace("/login");
      return;
    }

    if (user.role !== "DOCTOR" && user.role !== "PHARMACIST") {
      // CW-R2
      showToast("Please use the patient app / admin portal", "error");
      router.replace("/login");
      return;
    }

    if (pathname?.startsWith("/doctor") && user.role !== "DOCTOR") {
      // CW-R3
      router.replace("/pharmacy/prescriptions");
      return;
    }

    if (pathname?.startsWith("/pharmacy") && user.role !== "PHARMACIST") {
      // CW-R4
      router.replace("/doctor/today");
      return;
    }

    if (user.role !== requiredRole) {
      router.replace(HOME_BY_ROLE[user.role]);
      return;
    }

    setChecked(true);
  }, [loading, user, pathname, requiredRole, router, showToast]);

  if (loading || !checked) {
    return (
      <div className="page-loading" role="status">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
