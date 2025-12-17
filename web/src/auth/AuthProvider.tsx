import React, { createContext, useEffect, useMemo, useState } from "react";
import { http } from "../api/http";

export type AuthUser = { id: string; username: string; tenantId: string };

export type AuthState = {
  user: AuthUser | null;
  permissions: string[];
  csrfToken: string | null;
  loading: boolean;
  error?: string;
};

type AuthContextValue = AuthState & {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    permissions: [],
    csrfToken: localStorage.getItem("csrfToken"),
    loading: true,
  });

  const refreshMe = async () => {
    try {
      const res = await http.get("/auth/me");
      const csrfToken = res.data?.csrfToken ?? null;

      if (csrfToken) localStorage.setItem("csrfToken", csrfToken);

      setState({
        user: res.data?.user ?? null,
        permissions: res.data?.permissions ?? [],
        csrfToken,
        loading: false,
      });
    } catch {
      setState({
        user: null,
        permissions: [],
        csrfToken: null,
        loading: false,
      });
      localStorage.removeItem("csrfToken");
    }
  };

  useEffect(() => {
    refreshMe();
  }, []);

  const login = async (username: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const res = await http.post("/auth/login", { username, password });
      const csrfToken = res.data?.csrfToken ?? null;

      if (csrfToken) localStorage.setItem("csrfToken", csrfToken);

      setState({
        user: res.data?.user ?? null,
        permissions: res.data?.permissions ?? [],
        csrfToken,
        loading: false,
      });
    } catch (e: any) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e?.response?.data?.message ?? "Login failed",
      }));
      throw e;
    }
  };

  const logout = async () => {
    try {
      await http.post("/auth/logout");
    } finally {
      localStorage.removeItem("csrfToken");
      setState({ user: null, permissions: [], csrfToken: null, loading: false });
    }
  };

  const value = useMemo(
    () => ({ ...state, login, logout, refreshMe }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
