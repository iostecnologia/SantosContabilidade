import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "../lib/api-client";
import { decodeJwt } from "../lib/jwt";
import {
  clearTokens,
  getOrganization,
  getTokens,
  setOrganization,
  setTokens,
  subscribeToTokenChanges,
} from "../lib/token-storage";
import type { AccessTokenClaims, LoginResponse, OrganizationSummary } from "../types/auth";

interface AuthContextValue {
  isAuthenticated: boolean;
  organization: OrganizationSummary | null;
  claims: AccessTokenClaims | null;
  login: (input: { organizationSlug: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readState() {
  const tokens = getTokens();
  const claims = tokens ? decodeJwt<AccessTokenClaims>(tokens.accessToken) : null;
  return { claims, organization: getOrganization() };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ claims, organization }, setState] = useState(readState);

  useEffect(() => {
    // Refresh em background (disparado pelo api-client fora da árvore React)
    // grava tokens novos direto no localStorage — sincroniza o estado aqui.
    const unsubscribe = subscribeToTokenChanges(() => setState(readState()));
    const onForceLogout = () => setState(readState());
    window.addEventListener("auth:logout", onForceLogout);
    return () => {
      unsubscribe();
      window.removeEventListener("auth:logout", onForceLogout);
    };
  }, []);

  const login = useCallback(
    async (input: { organizationSlug: string; email: string; password: string }) => {
      const res = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      setOrganization(res.organization);
      setState(readState());
    },
    [],
  );

  const logout = useCallback(async () => {
    const tokens = getTokens();
    if (tokens) {
      await apiFetch("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: tokens.refreshToken }) }).catch(
        () => undefined,
      );
    }
    clearTokens();
    setState(readState());
  }, []);

  const hasPermission = useCallback((key: string) => claims?.permissions.includes(key) ?? false, [claims]);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated: claims !== null, organization, claims, login, logout, hasPermission }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth precisa estar dentro de um AuthProvider.");
  }
  return ctx;
}
