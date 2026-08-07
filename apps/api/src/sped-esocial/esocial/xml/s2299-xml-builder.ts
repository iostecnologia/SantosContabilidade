import { escapeXml, formatarDataEsocial, xmlIdeEmpregador, xmlIdeEvento } from "./esocial-xml.util";

export interface DadosS2299 {
  cnpj: string;
  registrationNumber: string;
  cpf: string;
  terminationDate: Date;
  mtvDeslig: string;
}

/** Desligamento — sem cálculo de verbas rescisórias detalhado no XML (já registrado em Termination/JournalEntry); reporta só data e motivo. */
export function gerarXmlS2299(dados: DadosS2299, id: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtDeslig/v_S_01_02_00">
  <evtDeslig Id="${escapeXml(id)}">
    ${xmlIdeEvento()}
    ${xmlIdeEmpregador(dados.cnpj)}
    <ideVinculo>
      <cpfTrab>${escapeXml(dados.cpf.replace(/\D/g, ""))}</cpfTrab>
      <matricula>${escapeXml(dados.registrationNumber)}</matricula>
    </ideVinculo>
    <infoDeslig>
      <mtvDeslig>${escapeXml(dados.mtvDeslig)}</mtvDeslig>
      <dtDeslig>${formatarDataEsocial(dados.terminationDate)}</dtDeslig>
      <indPagtoAPI>0</indPagtoAPI>
    </infoDeslig>
  </evtDeslig>
</eSocial>`;
}
