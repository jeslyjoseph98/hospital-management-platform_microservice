import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { fetchMe, loginAdmin, LoginInput } from '../api/auth';
import { clearToken, getToken, setToken } from '../api/token';
import { UNAUTHORIZED_EVENT } from '../api/client';
import { LoggedInUser } from '../types/domain';

interface AuthContextValue {
  user: LoggedInUser | null;
  /** True while the initial /auth/me restore-on-refresh call is in flight (AW-R5). */
  isLoading: boolean;
  login: (input: LoginInput) => Promise<LoggedInUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  useEffect(() => {
    // AW-R5: on page refresh, if a token is present, validate it via /auth/me.
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    fetchMe({ skipUnauthorizedRedirect: true })
      .then((me) => {
        if (me.role !== 'ADMIN') {
          // AW-R2: token role mismatch — reject it.
          clearToken();
          setUser(null);
        } else {
          setUser(me);
        }
      })
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    // AW-R4: any API 401 clears the token and the in-memory user.
    const handleUnauthorized = () => {
      clearToken();
      setUser(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const result = await loginAdmin(input);
    if (result.user.role !== 'ADMIN') {
      // AW-R2: reject a token with a role this app does not serve.
      throw new Error('Please use the patient app / clinic portal');
    }
    setToken(result.accessToken);
    setUser(result.user);
    return result.user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
