import { escapeXml, xmlIdeEmpregador, xmlIdeEvento } from "./esocial-xml.util";

export interface DadosS1000 {
  cnpj: string;
  esocialTaxClassCode: string;
  fpasCode: string;
  ratCode: number;
  fapRate: number;
  thirdPartiesCode?: string | null;
}

/** Evento não periódico — informações do empregador (classificação tributária, FPAS/RAT/FAP). */
export function gerarXmlS1000(dados: DadosS1000, id: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtInfoEmpregador/v_S_01_02_00">
  <evtInfoEmpregador Id="${escapeXml(id)}">
    ${xmlIdeEvento()}
    ${xmlIdeEmpregador(dados.cnpj)}
    <infoEmpregador>
      <infoCadastro>
        <classTrib>${escapeXml(dados.esocialTaxClassCode)}</classTrib>
        <indCoop>0</indCoop>
        <indConstr>0</indConstr>
        <indDesFolha>0</indDesFolha>
        <indOpcCP />
        <indPorte>0</indPorte>
        <indOptRegEletron>1</indOptRegEletron>
      </infoCadastro>
      <infoFolha>
        <infoFolhaAnterior>
          <fatorMes>0</fatorMes>
          <fatorDecimo>0</fatorDecimo>
        </infoFolhaAnterior>
      </infoFolha>
      <dadosIsencao />
      <infoOrgInternacional />
      <ideOrgaoDuplaVinc />
      <fpas>
        <codFpas>${escapeXml(dados.fpasCode)}</codFpas>
        <codRat>${dados.ratCode}</codRat>
        <fap>${dados.fapRate.toFixed(4)}</fap>
        ${dados.thirdPartiesCode ? `<codTercs>${escapeXml(dados.thirdPartiesCode)}</codTercs>` : ""}
      </fpas>
    </infoEmpregador>
  </evtInfoEmpregador>
</eSocial>`;
}
