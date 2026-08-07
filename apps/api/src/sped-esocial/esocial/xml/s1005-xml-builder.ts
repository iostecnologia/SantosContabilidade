import { escapeXml, xmlIdeEmpregador, xmlIdeEvento } from "./esocial-xml.util";

export interface DadosS1005 {
  cnpj: string;
  razaoSocial: string;
  cnaeCode: string;
  addressStreet: string;
  addressNumber?: string | null;
  addressNeighborhood: string;
  addressCityIbgeCode: string;
  addressState: string;
  addressZipCode: string;
}

/** Evento não periódico — cadastro do(s) estabelecimento(s); só o matriz (nrInsc = CNPJ raiz) é gerado aqui. */
export function gerarXmlS1005(dados: DadosS1005, id: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtTabEstab/v_S_01_02_00">
  <evtTabEstab Id="${escapeXml(id)}">
    ${xmlIdeEvento()}
    ${xmlIdeEmpregador(dados.cnpj)}
    <infoEstab>
      <inclusao>
        <ideEstab>
          <tpInsc>1</tpInsc>
          <nrInsc>${escapeXml(dados.cnpj.replace(/\D/g, "").padStart(14, "0"))}</nrInsc>
        </ideEstab>
        <dadosEstab>
          <cnaePrep>${escapeXml(dados.cnaeCode)}</cnaePrep>
          <infoCaepf />
          <infoObra />
          <infoTrab>
            <ideRT>0</ideRT>
          </infoTrab>
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
        </dadosEstab>
      </inclusao>
    </infoEstab>
  </evtTabEstab>
</eSocial>`;
}
