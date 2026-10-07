import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Top-level shell for all /admin/** screens: menu (Doctors · Departments · Bookings · Logout) — SVC-07A §5.
 */
export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">HMS Admin</div>
        <nav className="app-nav">
          <NavLink to="/admin/doctors" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Doctors
          </NavLink>
          <NavLink
            to="/admin/departments"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Departments
          </NavLink>
          <NavLink to="/admin/bookings" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Bookings
          </NavLink>
        </nav>
        <div className="app-user">
          {user && <span className="app-user-name">{user.name}</span>}
          <button type="button" className="btn btn-secondary" onClick={logout}>
            Logout
          </button>
        </div>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
