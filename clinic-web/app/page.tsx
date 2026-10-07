"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/** Root route: send the user to login, or to their home screen if already logged in. */
export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (user.role === "DOCTOR") {
      router.replace("/doctor/today");
    } else if (user.role === "PHARMACIST") {
      router.replace("/pharmacy/prescriptions");
    } else {
      router.replace("/login");
    }
  }, [user, loading, router]);

  return (
    <div className="page-loading" role="status">
      Loading...
    </div>
  );
}
