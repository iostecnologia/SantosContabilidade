import { escapeXml, formatarDataEsocial, xmlIdeEmpregador, xmlIdeEvento } from "./esocial-xml.util";

// Código de motivo de afastamento 15 = "Férias" — este módulo só usa S-2230
// para férias (ver comentário de TipoEventoEsocial), nunca para afastamentos
// médicos/outros motivos.
export const COD_MOT_AFAST_FERIAS = "15";

export interface DadosS2230 {
  cnpj: string;
  registrationNumber: string;
  cpf: string;
  startDate: Date;
  returnDate: Date;
}

/** Afastamento temporário — usado exclusivamente para registrar férias gozadas (codMotAfast=15). */
export function gerarXmlS2230(dados: DadosS2230, id: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtAfastTemp/v_S_01_02_00">
  <evtAfastTemp Id="${escapeXml(id)}">
    ${xmlIdeEvento()}
    ${xmlIdeEmpregador(dados.cnpj)}
    <ideVinculo>
      <cpfTrab>${escapeXml(dados.cpf.replace(/\D/g, ""))}</cpfTrab>
      <matricula>${escapeXml(dados.registrationNumber)}</matricula>
    </ideVinculo>
    <infoAfastamento>
      <iniAfastamento>
        <dtIniAfast>${formatarDataEsocial(dados.startDate)}</dtIniAfast>
        <codMotAfast>${COD_MOT_AFAST_FERIAS}</codMotAfast>
      </iniAfastamento>
    </infoAfastamento>
    <!-- Data de retorno (${formatarDataEsocial(dados.returnDate)}) não tem
         tag própria no leiaute real de S-2230 início — o retorno é reportado
         num evento de término separado (fora de escopo desta simplificação),
         mantida aqui só como referência para o contador. -->
  </evtAfastTemp>
</eSocial>`;
}
