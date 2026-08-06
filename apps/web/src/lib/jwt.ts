// Decodifica o payload de um JWT sem validar assinatura — só pra ler claims
// não sensíveis no cliente (permissions, sub, exp). A validação de verdade
// é sempre feita pelo backend a cada requisição.
export function decodeJwt<T>(token: string): T | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
