import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Route guard implementing AW-R1/AW-R2/AW-R5:
 * - No token / no user -> redirect to /login.
 * - While the initial /auth/me restore call is in flight, render nothing (avoids a
 *   login-screen flash on refresh).
 */
export function RequireAdmin() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="page-loading">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

/**
 * AW-R3: a logged-in admin opening /login or /register is redirected to /admin/doctors.
 */
export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="page-loading">Loading…</div>;
  }

  if (user) {
    return <Navigate to="/admin/doctors" replace />;
  }

  return <>{children}</>;
}
