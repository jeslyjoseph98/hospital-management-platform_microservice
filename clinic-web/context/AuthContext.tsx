"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, clearToken, getToken, setToken as persistToken } from "@/lib/apiClient";
import type { LoginUser } from "@/lib/types";

interface AuthContextValue {
  user: LoginUser | null;
  token: string | null;
  /** True while the initial /auth/me check (on load/refresh) is running. */
  loading: boolean;
  login: (token: string, user: LoginUser) => void;
  logout: () => void;
  /** Re-validates the token against /auth/me; clears state and returns null on 401. */
  refreshUser: () => Promise<LoginUser | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoginUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const login = useCallback((newToken: string, newUser: LoginUser) => {
    persistToken(newToken);
    setTokenState(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const existing = getToken();
    if (!existing) {
      setUser(null);
      setTokenState(null);
      return null;
    }
    try {
      const me = await apiFetch<LoginUser>("/auth/me");
      setTokenState(existing);
      setUser(me);
      return me;
    } catch {
      clearToken();
      setTokenState(null);
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    // CW-R7: on page refresh, validate via /auth/me.
    refreshUser().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, logout, refreshUser }),
    [user, token, loading, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
