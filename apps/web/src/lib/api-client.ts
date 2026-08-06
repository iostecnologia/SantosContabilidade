import { clearTokens, getTokens, setTokens, type TokenPair } from "./token-storage";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
}

// O refresh token do backend é rotacionado e de uso único (ver
// apps/api/src/auth/auth.service.ts) — reapresentar um já trocado derruba a
// sessão inteira. Se duas chamadas baterem 401 ao mesmo tempo (ex.: dashboard
// carregando 3 listas em paralelo quando o access token expira), elas
// precisam compartilhar UMA única chamada de refresh em vez de cada uma
// disparar a sua — senão a segunda chega com o token já rotacionado pela
// primeira e é tratada como reuso, revogando a família toda.
let refreshPromise: Promise<TokenPair> | null = null;

async function doRefresh(refreshToken: string): Promise<TokenPair> {
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    throw new Error("Falha ao renovar sessão.");
  }
  const data: RefreshResponse = await res.json();
  const tokens: TokenPair = { accessToken: data.accessToken, refreshToken: data.refreshToken };
  setTokens(tokens);
  return tokens;
}

function refreshTokens(currentRefreshToken: string): Promise<TokenPair> {
  if (!refreshPromise) {
    refreshPromise = doRefresh(currentRefreshToken).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function forceLogout(): void {
  clearTokens();
  window.dispatchEvent(new Event("auth:logout"));
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const tokens = getTokens();
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (tokens) {
    headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  }

  const res = await fetch(`/api${path}`, { ...options, headers });

  if (res.status === 401 && tokens && !isRetry) {
    try {
      await refreshTokens(tokens.refreshToken);
    } catch {
      forceLogout();
      throw new ApiError(401, "Sessão expirada. Faça login novamente.");
    }
    return apiFetch<T>(path, options, true);
  }

  if (res.status === 401) {
    forceLogout();
    throw new ApiError(401, "Sessão expirada. Faça login novamente.");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(", ") : (body?.message ?? "Erro inesperado.");
    throw new ApiError(res.status, message);
  }
  return body as T;
}

export const apiGet = <T>(path: string) => apiFetch<T>(path);
export const apiPost = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined });
export const apiPatch = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined });
export const apiDelete = <T>(path: string) => apiFetch<T>(path, { method: "DELETE" });
