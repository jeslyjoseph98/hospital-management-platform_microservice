"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/** Role-based top navigation per SVC-07C §5. */
export function AppHeader() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  if (!user) return null;

  return (
    <header className="app-header">
      <div className="brand">HMS Clinic</div>
      <nav className="app-nav">
        {user.role === "DOCTOR" && (
          <Link href="/doctor/today" className={pathname?.startsWith("/doctor/today") ? "active" : ""}>
            Today&apos;s Appointments
          </Link>
        )}
        {user.role === "PHARMACIST" && (
          <Link
            href="/pharmacy/prescriptions"
            className={pathname?.startsWith("/pharmacy/prescriptions") ? "active" : ""}
          >
            Prescriptions
          </Link>
        )}
        <span className="user-badge">{user.name}</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout}>
          Logout
        </button>
      </nav>
    </header>
  );
}
