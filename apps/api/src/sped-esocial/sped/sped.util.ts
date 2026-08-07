// Formatação comum aos arquivos-texto do SPED (ECD/EFD) — layout de campos
// delimitados por "|", linha iniciada e terminada por "|", CRLF entre linhas
// (padrão exigido pelo PVA do SPED). Todos os arquivos gerados por este
// módulo são para conferência do contador antes de importar no PVA oficial
// — nenhuma garantia de que passam na validação binária do programa (ver
// limite já documentado no módulo Fiscal/eSocial: sem certificado digital,
// sem transmissão, sem paridade garantida com a versão vigente do leiaute).
export function montarLinhaSped(campos: (string | number)[]): string {
  return `|${campos.join("|")}|`;
}

export function formatarDataSped(data: Date | string): string {
  const d = new Date(data);
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}${mes}${d.getUTCFullYear()}`;
}

export function formatarValorSped(valor: number): string {
  return valor.toFixed(2).replace(".", ",");
}

export function juntarArquivoSped(linhas: string[]): string {
  return linhas.join("\r\n") + "\r\n";
}
