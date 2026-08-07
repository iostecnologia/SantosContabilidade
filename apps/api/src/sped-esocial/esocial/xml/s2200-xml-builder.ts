import { escapeXml, formatarDataEsocial, xmlIdeEmpregador, xmlIdeEvento } from "./esocial-xml.util";

export interface DadosS2200 {
  cnpj: string;
  registrationNumber: string;
  cpf: string;
  fullName: string;
  birthDate: Date;
  sex: string;
  pis: string;
  ctpsNumber: string;
  ctpsSeries: string;
  addressStreet: string;
  addressNumber?: string | null;
  addressNeighborhood: string;
  addressCityIbgeCode: string;
  addressState: string;
  addressZipCode: string;
  admissionDate: Date;
  cboCode: string;
  esocialCategoryCode: number;
  baseSalary: number;
}

/** Admissão de empregado — vínculo celetista (única modalidade que o Departamento Pessoal deste sistema modela). */
export function gerarXmlS2200(dados: DadosS2200, id: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtAdmissao/v_S_01_02_00">
  <evtAdmissao Id="${escapeXml(id)}">
    ${xmlIdeEvento()}
    ${xmlIdeEmpregador(dados.cnpj)}
    <ideVinculo>
      <cpfTrab>${escapeXml(dados.cpf.replace(/\D/g, ""))}</cpfTrab>
      <matricula>${escapeXml(dados.registrationNumber)}</matricula>
    </ideVinculo>
    <trabalhador>
      <cpfTrab>${escapeXml(dados.cpf.replace(/\D/g, ""))}</cpfTrab>
      <nmTrab>${escapeXml(dados.fullName)}</nmTrab>
      <sexo>${escapeXml(dados.sex)}</sexo>
      <nascimento>
        <dtNascto>${formatarDataEsocial(dados.birthDate)}</dtNascto>
      </nascimento>
      <endereco>
        <brasil>
          <dscLograd>${escapeXml(dados.addressStreet)}</dscLograd>
          <nrLograd>${escapeXml(dados.addressNumber ?? "S/N")}</nrLograd>
          <bairro>${escapeXml(dados.addressNeighborhood)}</bairro>
          <cep>${escapeXml(dados.addressZipCode.replace(/\D/g, ""))}</cep>
          <codMunic>${escapeXml(dados.addressCityIbgeCode)}</codMunic>
          <uf>${escapeXml(dados.addressState)}</uf>
        </brasil>
      </endereco>
      <trabEstrangeiro />
      <infoDeficiencia />
      <dependente />
      <documentos>
        <CTPS>
          <nrCtps>${escapeXml(dados.ctpsNumber)}</nrCtps>
          <serieCtps>${escapeXml(dados.ctpsSeries)}</serieCtps>
        </CTPS>
        <NIS>
          <nrNis>${escapeXml(dados.pis)}</nrNis>
        </NIS>
      </documentos>
    </trabalhador>
    <vinculo>
      <matricula>${escapeXml(dados.registrationNumber)}</matricula>
      <tpRegTrab>1</tpRegTrab>
      <tpRegPrev>1</tpRegPrev>
      <cadIni>S</cadIni>
      <infoRegimeTrab>
        <infoCeletista>
          <dtAdm>${formatarDataEsocial(dados.admissionDate)}</dtAdm>
          <tpAdmissao>1</tpAdmissao>
          <indAdmissao>1</indAdmissao>
          <tpRegJor>1</tpRegJor>
          <natAtividade>1</natAtividade>
          <cargo>
            <codCargo>${escapeXml(dados.cboCode)}</codCargo>
          </cargo>
          <remuneracao>
            <vrSalFx>${dados.baseSalary.toFixed(2)}</vrSalFx>
            <undSalFixo>5</undSalFixo>
          </remuneracao>
          <fgts>
            <opcFGTS>1</opcFGTS>
          </fgts>
        </infoCeletista>
      </infoRegimeTrab>
      <infoContrato>
        <codCateg>${dados.esocialCategoryCode}</codCateg>
      </infoContrato>
    </vinculo>
  </evtAdmissao>
</eSocial>`;
}
