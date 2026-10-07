import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { BookingsPage } from './pages/BookingsPage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { DoctorCreatePage } from './pages/DoctorCreatePage';
import { DoctorEditPage } from './pages/DoctorEditPage';
import { DoctorsListPage } from './pages/DoctorsListPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { RedirectIfAuthenticated, RequireAdmin } from './routes/RequireAdmin';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/admin/doctors" replace />} />

          <Route
            path="/login"
            element={
              <RedirectIfAuthenticated>
                <LoginPage />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/register"
            element={
              <RedirectIfAuthenticated>
                <RegisterPage />
              </RedirectIfAuthenticated>
            }
          />

          <Route element={<RequireAdmin />}>
            <Route element={<AppLayout />}>
              <Route path="/admin/departments" element={<DepartmentsPage />} />
              <Route path="/admin/doctors" element={<DoctorsListPage />} />
              <Route path="/admin/doctors/new" element={<DoctorCreatePage />} />
              <Route path="/admin/doctors/:id" element={<DoctorEditPage />} />
              <Route path="/admin/bookings" element={<BookingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/admin/doctors" replace />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
