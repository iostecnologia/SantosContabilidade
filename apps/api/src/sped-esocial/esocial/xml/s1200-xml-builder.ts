import { escapeXml, xmlIdeEmpregador, xmlIdeEvento } from "./esocial-xml.util";

export interface DadosS1200 {
  cnpj: string;
  registrationNumber: string;
  cpf: string;
  esocialCategoryCode: number;
  competenceYear: number;
  competenceMonth: number;
  baseSalary: number;
}

// Código de rubrica genérico "salário base" — o Departamento Pessoal deste
// sistema não mantém uma tabela de rubricas própria por organização (só o
// valor consolidado de PayrollRunLine), então a remuneração é reportada como
// uma única rubrica em vez do detalhamento rubrica-a-rubrica que o leiaute
// real permite/exige.
const COD_RUBRICA_SALARIO_BASE = "1";

/** Remuneração mensal — um evento por vínculo (linha da folha), como no leiaute oficial. */
export function gerarXmlS1200(dados: DadosS1200, id: string): string {
  const competencia = `${dados.competenceYear}-${String(dados.competenceMonth).padStart(2, "0")}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtRemun/v_S_01_02_00">
  <evtRemun Id="${escapeXml(id)}">
    ${xmlIdeEvento()}
    ${xmlIdeEmpregador(dados.cnpj)}
    <ideVinculo>
      <cpfTrab>${escapeXml(dados.cpf.replace(/\D/g, ""))}</cpfTrab>
      <matricula>${escapeXml(dados.registrationNumber)}</matricula>
      <codCateg>${dados.esocialCategoryCode}</codCateg>
    </ideVinculo>
    <dmDev>
      <ideDmDev>${escapeXml(dados.registrationNumber)}-${escapeXml(competencia)}</ideDmDev>
      <perApur>${escapeXml(competencia)}</perApur>
      <ideEstabLot>
        <itensRemun>
          <codRubr>${COD_RUBRICA_SALARIO_BASE}</codRubr>
          <vrRubr>${dados.baseSalary.toFixed(2)}</vrRubr>
        </itensRemun>
      </ideEstabLot>
    </dmDev>
  </evtRemun>
</eSocial>`;
}
