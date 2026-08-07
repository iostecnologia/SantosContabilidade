import { DocumentoFiscal } from "../domain/documento-fiscal";
import { DadosDestinatario, DadosEmitente, escapeXml, formatarValor } from "./xml.util";

/**
 * Estrutura BÁSICA de referência da NF-e (modelo 55, layout 4.00) — cobre os
 * grupos obrigatórios mais comuns (ide/emit/dest/det/total) para representar
 * fielmente os dados que este sistema tem. NÃO é validada contra o XSD
 * oficial da SEFAZ, NÃO tem assinatura digital (exige certificado A1/A3, que
 * este sistema não manuseia) e NÃO é transmitida a nenhum webservice — é um
 * ponto de partida para quem for assinar/transmitir por fora.
 */
export function gerarXmlNfe(
  documento: DocumentoFiscal,
  emitente: DadosEmitente = { cnpj: "00000000000000", razaoSocial: "EMITENTE NAO CONFIGURADO" },
  destinatario: DadosDestinatario = { documento: "00000000000000", razaoSocial: "DESTINATARIO NAO CONFIGURADO" },
): string {
  const dataEmissao = new Date(documento.dataEmissao).toISOString();
  const itens = documento.itens
    .map(
      (item, index) => `    <det nItem="${index + 1}">
      <prod>
        <cProd>${escapeXml(String(index + 1))}</cProd>
        <xProd>${escapeXml(item.descricao)}</xProd>
        <NCM>${escapeXml(item.ncm ?? "00000000")}</NCM>
        <CFOP>${item.ufOrigem && item.ufDestino && item.ufOrigem !== item.ufDestino ? "6102" : "5102"}</CFOP>
        <uCom>UN</uCom>
        <qCom>${item.quantidade}</qCom>
        <vUnCom>${formatarValor(item.valorUnitario)}</vUnCom>
        <vProd>${formatarValor(item.valorTotal)}</vProd>
      </prod>
      <imposto>
        <!-- ICMSSN102 (CSOSN, regime Simples Nacional) fixo por simplificação —
             Lucro Presumido/Real usaria um grupo <ICMS00.../> com CST e base
             de cálculo próprios, não implementado nesta versão. -->
        <ICMS>
          <ICMSSN102>
            <orig>0</orig>
            <CSOSN>102</CSOSN>
          </ICMSSN102>
        </ICMS>
      </imposto>
    </det>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe versao="4.00" Id="NFe${documento.numeroDocumento.padStart(44, "0")}">
    <ide>
      <natOp>${escapeXml(documento.naturezaOperacao)}</natOp>
      <mod>55</mod>
      <serie>1</serie>
      <nNF>${escapeXml(documento.numeroDocumento)}</nNF>
      <dhEmi>${dataEmissao}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <tpAmb>2</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>0</indFinal>
      <indPres>0</indPres>
    </ide>
    <emit>
      <CNPJ>${escapeXml(emitente.cnpj)}</CNPJ>
      <xNome>${escapeXml(emitente.razaoSocial)}</xNome>
    </emit>
    <dest>
      <CNPJ>${escapeXml(destinatario.documento)}</CNPJ>
      <xNome>${escapeXml(destinatario.razaoSocial)}</xNome>
    </dest>
${itens}
    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>${formatarValor(documento.impostosApurados?.icms ?? 0)}</vICMS>
        <vProd>${formatarValor(documento.valorTotal)}</vProd>
        <vNF>${formatarValor(documento.valorTotal)}</vNF>
      </ICMSTot>
    </total>
    <transp>
      <modFrete>9</modFrete>
    </transp>
    <infAdic>
      <infCpl>Documento gerado sem assinatura digital, apenas para conferencia. Nao valido para transito de mercadoria ou obrigacao fiscal ate ser assinado e autorizado pela SEFAZ.</infCpl>
    </infAdic>
  </infNFe>
</NFe>`;
}
