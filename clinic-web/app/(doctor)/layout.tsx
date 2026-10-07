import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";

export default function DoctorLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard requiredRole="DOCTOR">
      <div className="app-shell">
        <AppHeader />
        <main className="app-main">{children}</main>
      </div>
    </AuthGuard>
  );
}
