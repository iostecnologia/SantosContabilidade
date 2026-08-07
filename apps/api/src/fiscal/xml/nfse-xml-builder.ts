import { DocumentoFiscal } from "../domain/documento-fiscal";
import { DadosDestinatario, DadosEmitente, escapeXml, formatarValor } from "./xml.util";

/**
 * Estrutura BÁSICA de referência de NFS-e no padrão ABRASF v2.04 (RPS/Nfse)
 * — o modelo mais adotado por municípios antes da NFS-e Nacional, mas não
 * um padrão único: cada prefeitura pode exigir variações no schema, nos
 * códigos de serviço, ou usar layout próprio. Sem assinatura digital, sem
 * transmissão ao webservice da prefeitura.
 */
export function gerarXmlNfse(
  documento: DocumentoFiscal,
  emitente: DadosEmitente = { cnpj: "00000000000000", razaoSocial: "EMITENTE NAO CONFIGURADO" },
  destinatario: DadosDestinatario = { documento: "00000000000000", razaoSocial: "DESTINATARIO NAO CONFIGURADO" },
): string {
  const discriminacao = documento.itens.map((item) => item.descricao).join("; ");
  const codigoServico = documento.itens.find((item) => item.codigoServicoMunicipal)?.codigoServicoMunicipal ?? "0000";
  const valorIss = documento.impostosApurados?.iss ?? documento.impostosApurados?.simplesNacionalDas ?? 0;
  const valorPis = documento.impostosApurados?.pis ?? 0;
  const valorCofins = documento.impostosApurados?.cofins ?? 0;

  return `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
  <LoteRps Id="lote-${escapeXml(documento.numeroDocumento)}" versao="2.04">
    <NumeroLote>${escapeXml(documento.numeroDocumento)}</NumeroLote>
    <Cnpj>${escapeXml(emitente.cnpj)}</Cnpj>
    <QuantidadeRps>1</QuantidadeRps>
    <ListaRps>
      <Rps>
        <InfDeclaracaoPrestacaoServico Id="rps-${escapeXml(documento.numeroDocumento)}">
          <Rps>
            <IdentificacaoRps>
              <Numero>${escapeXml(documento.numeroDocumento)}</Numero>
              <Serie>1</Serie>
              <Tipo>1</Tipo>
            </IdentificacaoRps>
            <DataEmissao>${new Date(documento.dataEmissao).toISOString().slice(0, 10)}</DataEmissao>
            <Status>1</Status>
          </Rps>
          <Competencia>${new Date(documento.dataCompetencia).toISOString().slice(0, 10)}</Competencia>
          <Servico>
            <Valores>
              <ValorServicos>${formatarValor(documento.valorTotal)}</ValorServicos>
              <ValorIss>${formatarValor(valorIss)}</ValorIss>
              <ValorPis>${formatarValor(valorPis)}</ValorPis>
              <ValorCofins>${formatarValor(valorCofins)}</ValorCofins>
            </Valores>
            <ItemListaServico>${escapeXml(codigoServico)}</ItemListaServico>
            <Discriminacao>${escapeXml(discriminacao)}</Discriminacao>
          </Servico>
          <Prestador>
            <CpfCnpj>
              <Cnpj>${escapeXml(emitente.cnpj)}</Cnpj>
            </CpfCnpj>
          </Prestador>
          <Tomador>
            <IdentificacaoTomador>
              <CpfCnpj>
                <Cnpj>${escapeXml(destinatario.documento)}</Cnpj>
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>${escapeXml(destinatario.razaoSocial)}</RazaoSocial>
          </Tomador>
        </InfDeclaracaoPrestacaoServico>
      </Rps>
    </ListaRps>
  </LoteRps>
</EnviarLoteRpsEnvio>`;
}
