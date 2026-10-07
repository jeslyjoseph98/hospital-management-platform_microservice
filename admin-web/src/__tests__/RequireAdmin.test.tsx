import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock useAuth so we can drive RequireAdmin's branches directly (no network calls).
const useAuthMock = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

import { RedirectIfAuthenticated, RequireAdmin } from '../routes/RequireAdmin';

function renderWithRoute(initialPath: string, guardedElement: JSX.Element) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Login Screen</div>} />
        <Route path="/admin/doctors" element={<div>Doctors Screen</div>} />
        <Route element={<RequireAdmin />}>
          <Route path="/admin/protected" element={guardedElement} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAdmin (AW-R1, AW-R5)', () => {
  afterEach(() => {
    useAuthMock.mockReset();
  });

  it('renders nothing but a loading state while the session restore is in flight', () => {
    useAuthMock.mockReturnValue({ user: null, isLoading: true });
    renderWithRoute('/admin/protected', <div>Protected content</div>);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('redirects to /login when there is no authenticated user', () => {
    useAuthMock.mockReturnValue({ user: null, isLoading: false });
    renderWithRoute('/admin/protected', <div>Protected content</div>);
    expect(screen.getByText('Login Screen')).toBeInTheDocument();
  });

  it('renders the protected route when an admin user is present', () => {
    useAuthMock.mockReturnValue({ user: { id: 1, role: 'ADMIN', name: 'Admin' }, isLoading: false });
    renderWithRoute('/admin/protected', <div>Protected content</div>);
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});

describe('RedirectIfAuthenticated (AW-R3)', () => {
  afterEach(() => {
    useAuthMock.mockReset();
  });

  it('redirects a logged-in admin away from /login to /admin/doctors', () => {
    useAuthMock.mockReturnValue({ user: { id: 1, role: 'ADMIN', name: 'Admin' }, isLoading: false });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/admin/doctors" element={<div>Doctors Screen</div>} />
          <Route
            path="/login"
            element={
              <RedirectIfAuthenticated>
                <div>Login Screen</div>
              </RedirectIfAuthenticated>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Doctors Screen')).toBeInTheDocument();
  });

  it('renders the login screen when there is no authenticated user', () => {
    useAuthMock.mockReturnValue({ user: null, isLoading: false });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/admin/doctors" element={<div>Doctors Screen</div>} />
          <Route
            path="/login"
            element={
              <RedirectIfAuthenticated>
                <div>Login Screen</div>
              </RedirectIfAuthenticated>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Login Screen')).toBeInTheDocument();
  });
});
