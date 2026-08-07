import { TP_AMB_PRODUCAO_RESTRITA } from "../domain/tipo-evento-esocial";

export { escapeXml } from "../../../fiscal/xml/xml.util";

export function formatarDataEsocial(data: Date | string): string {
  return new Date(data).toISOString().slice(0, 10);
}

export function formatarDecimalEsocial(valor: number): string {
  return valor.toFixed(2);
}

/**
 * Aproximação do algoritmo oficial do atributo `Id` do evento (tpAmb + tpInsc
 * + nrInsc + AAAAMMDDHHmmss + sequencial de 5 dígitos) — nunca transmitido a
 * um webservice real, então fidelidade exata ao layout não é garantida aqui
 * (ver limite de "produção restrita"/sem transmissão em TipoEventoEsocial).
 */
export function buildEsocialEventId(nrInsc: string, sequencial: number): string {
  const nrInscLimpo = nrInsc.replace(/\D/g, "").padStart(14, "0");
  const agora = new Date();
  const dataHora = agora.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const seq = String(sequencial % 100000).padStart(5, "0");
  return `ID1${TP_AMB_PRODUCAO_RESTRITA}${nrInscLimpo}${dataHora}${seq}`;
}

export function xmlIdeEvento(): string {
  return `<ideEvento>
      <indRetif>1</indRetif>
      <tpAmb>${TP_AMB_PRODUCAO_RESTRITA}</tpAmb>
      <procEmi>1</procEmi>
      <verProc>SantosSAF-1.0</verProc>
    </ideEvento>`;
}

export function xmlIdeEmpregador(cnpj: string): string {
  const nrInscLimpo = cnpj.replace(/\D/g, "").padStart(14, "0");
  return `<ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${nrInscLimpo}</nrInsc>
    </ideEmpregador>`;
}
