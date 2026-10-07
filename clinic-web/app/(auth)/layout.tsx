"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/** CW-R5: logged in and on /login or /register -> redirect to own home. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user?.role === "DOCTOR") {
      router.replace("/doctor/today");
      return;
    }
    if (user?.role === "PHARMACIST") {
      router.replace("/pharmacy/prescriptions");
      return;
    }
    setReady(true);
  }, [user, loading, router]);

  if (loading || !ready) {
    return (
      <div className="page-loading" role="status">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
