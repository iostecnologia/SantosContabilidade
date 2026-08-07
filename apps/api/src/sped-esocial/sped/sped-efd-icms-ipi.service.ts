import { BadRequestException, Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { PrismaTransactionAdapter } from "../../tenancy/tenancy.module";
import { DocumentoFiscal, NaturezaOperacaoFiscal } from "../../fiscal/domain/documento-fiscal";
import { formatarDataSped, formatarValorSped, juntarArquivoSped, montarLinhaSped } from "./sped.util";

const TIPOS_MERCADORIA = new Set(["NFE", "NFCE"]);

// CFOP não é um campo do domínio DocumentoFiscal (só NCM) — derivado aqui a
// partir da natureza da operação + comparação de UF (mesma UF vs
// interestadual), como uma aproximação estrutural. Um CFOP real também
// varia por finalidade (revenda, ativo imobilizado, uso/consumo) com muito
// mais granularidade do que este sistema modela; ver aviso retornado por
// `gerar()`.
function derivarCfop(natureza: NaturezaOperacaoFiscal, ufOrigem: string | undefined, ufDestino: string | undefined, ufPropria: string | undefined): string {
  const mesmaUf = !ufOrigem || !ufDestino || !ufPropria ? true : ufOrigem === ufDestino;
  if (natureza === NaturezaOperacaoFiscal.VENDA_MERCADORIA) {
    return mesmaUf ? "5102" : "6102";
  }
  if (natureza === NaturezaOperacaoFiscal.COMPRA_ATIVO_IMOBILIZADO) {
    return mesmaUf ? "1551" : "2551";
  }
  return mesmaUf ? "1102" : "2102";
}

/**
 * Geração stateless da EFD ICMS/IPI (Bloco 0/C/E) — só ICMS: este sistema
 * não apura IPI em nenhum lugar (ApuracaoTributariaService não calcula IPI),
 * então os registros E200/E210 (apuração de IPI) são omitidos por completo
 * em vez de emitidos zerados, o que enganaria o contador. Escopo restrito a
 * documentos NF-e/NFC-e (`tipo` tradicional) — documentos CBS/IBS da reforma
 * tributária não usam ICMS/IPI e não entram nesta EFD legada.
 */
@Injectable()
export class SpedEfdIcmsIpiService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionAdapter>) {}

  private get tx() {
    return this.txHost.tx;
  }

  async gerar(organizationId: string, year: number, month: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException("Informe um ano-calendário válido.");
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException("Informe um mês (1-12) válido.");
    }

    const organization = await this.tx.organization.findFirstOrThrow({ where: { id: organizationId } });
    const registration = await this.tx.companyRegistration.findFirst({ where: { organizationId } });
    const dtIni = new Date(Date.UTC(year, month - 1, 1));
    const dtFin = new Date(Date.UTC(year, month, 0));

    const documentos = await this.tx.fiscalDocumentoEmitido.findMany({
      where: { organizationId, dataCompetencia: { gte: dtIni, lte: dtFin }, tipo: { in: [...TIPOS_MERCADORIA] } },
      orderBy: { numeroDocumento: "asc" },
    });
    const contraparteIds = [...new Set(documentos.map((d) => d.contraparteId))];
    const contrapartes = await this.tx.counterparty.findMany({ where: { id: { in: contraparteIds }, organizationId } });
    const contraparteById = new Map(contrapartes.map((c) => [c.id, c]));

    const linhas: string[] = [];
    linhas.push(montarLinhaSped(["0000", "013", "0", formatarDataSped(dtIni), formatarDataSped(dtFin), organization.name, organization.taxId ?? "", registration?.stateRegistration ?? "", registration?.addressCity ?? "", registration?.addressState ?? ""]));
    linhas.push(montarLinhaSped(["0001", documentos.length > 0 ? "0" : "1"]));
    for (const contraparte of contrapartes) {
      linhas.push(montarLinhaSped(["0150", contraparte.id, contraparte.name, contraparte.type === "CUSTOMER" ? "02" : "01", contraparte.taxId ?? ""]));
    }
    const descricoesProduto = new Set<string>();
    for (const doc of documentos) {
      const documentoFiscal = doc.documentoJson as unknown as DocumentoFiscal;
      for (const item of documentoFiscal.itens) {
        descricoesProduto.add(`${item.descricao}|${item.ncm ?? ""}`);
      }
    }
    for (const chave of descricoesProduto) {
      const [descricao, ncm] = chave.split("|");
      linhas.push(montarLinhaSped(["0200", descricao, ncm]));
    }
    linhas.push(montarLinhaSped(["0990", (linhas.length + 1).toString()]));

    let baseIcms = 0;
    let valorIcms = 0;
    linhas.push(montarLinhaSped(["C001", documentos.length > 0 ? "0" : "1"]));
    for (const doc of documentos) {
      const documentoFiscal = doc.documentoJson as unknown as DocumentoFiscal;
      const icms = documentoFiscal.impostosApurados?.icms ?? 0;
      const contraparte = contraparteById.get(doc.contraparteId);
      linhas.push(
        montarLinhaSped(["C100", contraparte?.id ?? "", doc.numeroDocumento, formatarDataSped(doc.dataEmissao), formatarValorSped(Number(doc.valorTotal))]),
      );
      for (const item of documentoFiscal.itens) {
        const cfop = derivarCfop(documentoFiscal.naturezaOperacao, item.ufOrigem, item.ufDestino, registration?.addressState ?? undefined);
        linhas.push(montarLinhaSped(["C170", item.descricao, formatarValorSped(item.valorTotal), cfop, item.ncm ?? "", "000"]));
      }
      linhas.push(montarLinhaSped(["C190", "000", formatarValorSped(Number(doc.valorTotal)), formatarValorSped(Number(doc.valorTotal)), formatarValorSped(icms)]));
      baseIcms += Number(doc.valorTotal);
      valorIcms += icms;
    }
    linhas.push(montarLinhaSped(["C990", (linhas.filter((l) => l.startsWith("|C")).length + 1).toString()]));

    linhas.push(montarLinhaSped(["E001", "0"]));
    linhas.push(montarLinhaSped(["E100", formatarDataSped(dtIni), formatarDataSped(dtFin)]));
    linhas.push(
      montarLinhaSped(["E110", formatarValorSped(valorIcms), "0,00", "0,00", "0,00", "0,00", "0,00", "0,00", formatarValorSped(valorIcms)]),
    );
    linhas.push(montarLinhaSped(["E990", "4"]));

    linhas.push(montarLinhaSped(["9001", "0"]));
    linhas.push(montarLinhaSped(["9990", "2"]));
    linhas.push(montarLinhaSped(["9999", (linhas.length + 1).toString()]));

    return {
      nomeArquivo: `EFD-ICMS-IPI-${organization.taxId ?? organization.id}-${year}${String(month).padStart(2, "0")}.txt`,
      conteudo: juntarArquivoSped(linhas),
      totalDocumentos: documentos.length,
      baseIcms,
      valorIcms,
      avisoIpi: "Este sistema não apura IPI — registros E200/E210 (apuração de IPI) foram omitidos, não emitidos zerados.",
    };
  }
}
