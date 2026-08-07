export function escapeXml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function formatarValor(valor: number): string {
  return valor.toFixed(2);
}

export interface DadosEmitente {
  cnpj: string;
  razaoSocial: string;
}

export interface DadosDestinatario {
  documento: string;
  razaoSocial: string;
}
