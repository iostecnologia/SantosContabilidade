import type { OrganizationSummary } from "../types/auth";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const ACCESS_KEY = "santos-saf.accessToken";
const REFRESH_KEY = "santos-saf.refreshToken";
const ORG_KEY = "santos-saf.organization";

type Listener = () => void;
const listeners = new Set<Listener>();

// Pub-sub simples: o api-client (fora da árvore React) grava tokens durante
// um refresh em background, e o AuthProvider precisa saber pra atualizar o
// estado React em vez de ler localStorage direto a cada render.
function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeToTokenChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTokens(): TokenPair | null {
  const accessToken = localStorage.getItem(ACCESS_KEY);
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export function setTokens(tokens: TokenPair): void {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  notify();
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(ORG_KEY);
  notify();
}

// Nome/slug da organização não vêm no JWT (só sub/organizationId/permissions)
// — guardados à parte, capturados uma vez no login e mantidos até logout.
export function getOrganization(): OrganizationSummary | null {
  const raw = localStorage.getItem(ORG_KEY);
  return raw ? (JSON.parse(raw) as OrganizationSummary) : null;
}

export function setOrganization(organization: OrganizationSummary): void {
  localStorage.setItem(ORG_KEY, JSON.stringify(organization));
  notify();
}
