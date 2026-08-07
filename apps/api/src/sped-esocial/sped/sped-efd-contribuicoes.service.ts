import { BadRequestException, Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { PrismaTransactionAdapter } from "../../tenancy/tenancy.module";
import { DocumentoFiscal } from "../../fiscal/domain/documento-fiscal";
import { formatarDataSped, formatarValorSped, juntarArquivoSped, montarLinhaSped } from "./sped.util";

const TIPOS_SERVICO = new Set(["NFSE_NACIONAL", "NFSE_VIA"]);

/**
 * Geração stateless da EFD-Contribuições (Bloco 0/A/C/M) — mesmo raciocínio
 * de SpedEcdService: recalcula tudo a partir de FiscalDocumentoEmitido a
 * cada chamada, nada persistido. Cobre só PIS/COFINS não-cumulativo por
 * apuração agregada (alíquota única configurada em FiscalTaxSettings, sem
 * crédito de insumos discriminado por NCM) — mesma simplificação já assumida
 * por ApuracaoTributariaService. Documentos CBS/IBS (reforma tributária) não
 * entram aqui: PIS/COFINS são extintos pela EC 132/2023 e substituídos por
 * CBS, que não tem registro nesta EFD legada.
 */
@Injectable()
export class SpedEfdContribuicoesService {
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
    const taxSettings = await this.tx.fiscalTaxSettings.findFirst({ where: { organizationId } });
    if (!taxSettings || !taxSettings.pisCofinsRegime) {
      throw new BadRequestException("Configure o regime e as alíquotas de PIS/COFINS em Configurações Fiscais antes de gerar a EFD-Contribuições.");
    }

    const dtIni = new Date(Date.UTC(year, month - 1, 1));
    const dtFin = new Date(Date.UTC(year, month, 0));

    const documentos = await this.tx.fiscalDocumentoEmitido.findMany({
      where: { organizationId, dataCompetencia: { gte: dtIni, lte: dtFin } },
      orderBy: { numeroDocumento: "asc" },
    });

    const linhas: string[] = [];
    linhas.push(montarLinhaSped(["0000", "EFD_CONTRIBUICOES", "0", organization.name, organization.taxId ?? "", formatarDataSped(dtIni), formatarDataSped(dtFin)]));
    linhas.push(montarLinhaSped(["0001", documentos.length > 0 ? "0" : "1"]));
    linhas.push(montarLinhaSped(["0140", organization.name, organization.taxId ?? ""]));
    linhas.push(montarLinhaSped(["0990", "4"]));

    const servicos = documentos.filter((d) => TIPOS_SERVICO.has(d.tipo));
    const mercadorias = documentos.filter((d) => !TIPOS_SERVICO.has(d.tipo));

    let basePisServicos = 0;
    let baseCofinsServicos = 0;
    linhas.push(montarLinhaSped(["A001", servicos.length > 0 ? "0" : "1"]));
    for (const doc of servicos) {
      const documentoFiscal = doc.documentoJson as unknown as DocumentoFiscal;
      const pis = documentoFiscal.impostosApurados?.pis ?? 0;
      const cofins = documentoFiscal.impostosApurados?.cofins ?? 0;
      basePisServicos += Number(doc.valorTotal);
      baseCofinsServicos += Number(doc.valorTotal);
      linhas.push(montarLinhaSped(["A100", doc.numeroDocumento, formatarDataSped(doc.dataEmissao), formatarValorSped(Number(doc.valorTotal))]));
      linhas.push(montarLinhaSped(["A170", doc.numeroDocumento, formatarValorSped(Number(doc.valorTotal)), formatarValorSped(pis), formatarValorSped(cofins)]));
    }
    linhas.push(montarLinhaSped(["A990", (servicos.length * 2 + 2).toString()]));

    let basePisMercadorias = 0;
    let baseCofinsMercadorias = 0;
    linhas.push(montarLinhaSped(["C001", mercadorias.length > 0 ? "0" : "1"]));
    for (const doc of mercadorias) {
      const documentoFiscal = doc.documentoJson as unknown as DocumentoFiscal;
      const pis = documentoFiscal.impostosApurados?.pis ?? 0;
      const cofins = documentoFiscal.impostosApurados?.cofins ?? 0;
      basePisMercadorias += Number(doc.valorTotal);
      baseCofinsMercadorias += Number(doc.valorTotal);
      linhas.push(montarLinhaSped(["C100", doc.numeroDocumento, formatarDataSped(doc.dataEmissao), formatarValorSped(Number(doc.valorTotal))]));
      for (const item of documentoFiscal.itens) {
        linhas.push(montarLinhaSped(["C170", doc.numeroDocumento, item.descricao, formatarValorSped(item.valorTotal), item.ncm ?? ""]));
      }
      linhas.push(montarLinhaSped(["C190", doc.numeroDocumento, formatarValorSped(pis), formatarValorSped(cofins)]));
    }
    linhas.push(montarLinhaSped(["C990", (linhas.filter((l) => l.startsWith("|C")).length + 1).toString()]));

    const basePis = basePisServicos + basePisMercadorias;
    const baseCofins = baseCofinsServicos + baseCofinsMercadorias;
    const valorPis = basePis * Number(taxSettings.pisRate);
    const valorCofins = baseCofins * Number(taxSettings.cofinsRate);

    linhas.push(montarLinhaSped(["M001", "0"]));
    linhas.push(montarLinhaSped(["M200", formatarValorSped(valorPis), "0,00", "0,00", formatarValorSped(valorPis)]));
    linhas.push(montarLinhaSped(["M210", "01", formatarValorSped(basePis), formatarValorSped(Number(taxSettings.pisRate) * 100), formatarValorSped(valorPis)]));
    linhas.push(montarLinhaSped(["M600", formatarValorSped(valorCofins), "0,00", "0,00", formatarValorSped(valorCofins)]));
    linhas.push(montarLinhaSped(["M610", "01", formatarValorSped(baseCofins), formatarValorSped(Number(taxSettings.cofinsRate) * 100), formatarValorSped(valorCofins)]));
    linhas.push(montarLinhaSped(["M990", "6"]));

    linhas.push(montarLinhaSped(["9001", "0"]));
    linhas.push(montarLinhaSped(["9990", "2"]));
    linhas.push(montarLinhaSped(["9999", (linhas.length + 1).toString()]));

    return {
      nomeArquivo: `EFD-CONTRIBUICOES-${organization.taxId ?? organization.id}-${year}${String(month).padStart(2, "0")}.txt`,
      conteudo: juntarArquivoSped(linhas),
      totalDocumentos: documentos.length,
      basePis,
      baseCofins,
      valorPis,
      valorCofins,
    };
  }
}
