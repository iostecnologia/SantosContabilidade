import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Prisma } from "@prisma/client";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { FiscalLancamentoService } from "./fiscal-lancamento.service";
import { FiscalTaxSettingsService } from "./fiscal-tax-settings.service";
import { CategoriaContaFiscal } from "./domain/categoria-conta-fiscal";
import { DocumentoFiscal } from "./domain/documento-fiscal";
import { gerarXmlNfe } from "./xml/nfe-xml-builder";
import { gerarXmlNfse } from "./xml/nfse-xml-builder";

/**
 * Camada de persistência do módulo Fiscal — o resto do módulo
 * (ContextoContabilFiscal/estratégias/FiscalLancamentoService) é
 * propositalmente stateless, guardando só o lançamento contábil resultante.
 * Este serviço guarda também o DOCUMENTO em si (`documentoJson`), para dar
 * suporte a uma listagem de "documentos emitidos" e permitir regerar o XML
 * depois sem pedir o documento de novo ao chamador.
 */
@Injectable()
export class FiscalDocumentosService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionAdapter>,
    private readonly fiscalLancamento: FiscalLancamentoService,
    private readonly fiscalTaxSettings: FiscalTaxSettingsService,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  // Traduz o mapeamento contábil configurado uma vez em Configurações
  // Fiscais para o Record<CategoriaContaFiscal, string> que as estratégias
  // esperam — só assim a emissão fica de fato automática (sem o chamador
  // precisar repassar conta por conta a cada documento). Categorias que
  // FiscalTaxSettings não cobre (ex.: FORNECEDORES_A_PAGAR, DESPESA_OPERACIONAL,
  // usadas por compra/serviço tomado/CBS-IBS) continuam vindo de
  // `mapeamentoContabil` explícito, se informado.
  private async buildMapeamento(organizationId: string, mapeamentoExplicito: Record<string, string>) {
    const settings = await this.fiscalTaxSettings.getOrCreate(organizationId);
    const doSettings: Partial<Record<CategoriaContaFiscal, string>> = {};
    if (settings.receitaVendasAccountId) doSettings[CategoriaContaFiscal.RECEITA_VENDAS] = settings.receitaVendasAccountId;
    if (settings.receitaServicosAccountId) doSettings[CategoriaContaFiscal.RECEITA_SERVICOS] = settings.receitaServicosAccountId;
    if (settings.deducoesTributariasVendasAccountId)
      doSettings[CategoriaContaFiscal.DEDUCOES_TRIBUTARIAS_VENDAS] = settings.deducoesTributariasVendasAccountId;
    if (settings.deducoesTributariasServicosAccountId)
      doSettings[CategoriaContaFiscal.DEDUCOES_TRIBUTARIAS_SERVICOS] = settings.deducoesTributariasServicosAccountId;
    if (settings.clientesAReceberAccountId) doSettings[CategoriaContaFiscal.CLIENTES_A_RECEBER] = settings.clientesAReceberAccountId;
    if (settings.icmsPayableAccountId) doSettings[CategoriaContaFiscal.ICMS_A_RECOLHER] = settings.icmsPayableAccountId;
    if (settings.pisPayableAccountId) doSettings[CategoriaContaFiscal.PIS_A_RECOLHER] = settings.pisPayableAccountId;
    if (settings.cofinsPayableAccountId) doSettings[CategoriaContaFiscal.COFINS_A_RECOLHER] = settings.cofinsPayableAccountId;
    if (settings.issPayableAccountId) doSettings[CategoriaContaFiscal.ISS_A_RECOLHER] = settings.issPayableAccountId;
    if (settings.simplesNacionalPayableAccountId)
      doSettings[CategoriaContaFiscal.SIMPLES_NACIONAL_A_RECOLHER] = settings.simplesNacionalPayableAccountId;

    // Explícito por chamada tem prioridade — permite sobrescrever pontualmente.
    return { ...doSettings, ...mapeamentoExplicito };
  }

  list(organizationId: string) {
    return this.tx.fiscalDocumentoEmitido.findMany({
      where: { organizationId },
      orderBy: { dataEmissao: "desc" },
    });
  }

  async findOneOrThrow(organizationId: string, id: string) {
    const documento = await this.tx.fiscalDocumentoEmitido.findFirst({ where: { id, organizationId } });
    if (!documento) {
      throw new NotFoundException("Documento fiscal não encontrado.");
    }
    return documento;
  }

  async emitir(
    organizationId: string,
    userId: string,
    documentoOriginal: DocumentoFiscal,
    mapeamentoContabil: Record<string, string> = {},
  ) {
    // Calcula os tributos ANTES de lançar, para que o snapshot persistido
    // (documentoJson) já contenha os valores usados no lançamento contábil —
    // apurarSeNecessario() não recalcula se `lancar` já receber o resultado.
    const documento = await this.fiscalLancamento.apurarSeNecessario(organizationId, documentoOriginal);
    const mapeamento = await this.buildMapeamento(organizationId, mapeamentoContabil);
    const entry = await this.fiscalLancamento.lancar(organizationId, userId, documento, mapeamento);

    try {
      const persistido = await this.tx.fiscalDocumentoEmitido.create({
        data: {
          organizationId,
          tipo: documento.tipo,
          naturezaOperacao: documento.naturezaOperacao,
          numeroDocumento: documento.numeroDocumento,
          dataEmissao: new Date(documento.dataEmissao),
          dataCompetencia: new Date(documento.dataCompetencia),
          contraparteId: documento.fornecedorOuClienteId,
          valorTotal: documento.valorTotal,
          documentoJson: documento as unknown as Prisma.InputJsonValue,
          journalEntryId: entry.id,
          createdBy: userId,
        },
      });
      return { ...persistido, journalEntry: entry };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Já existe um documento fiscal com este número nesta organização.");
      }
      throw err;
    }
  }

  async gerarXml(organizationId: string, id: string): Promise<{ nomeArquivo: string; conteudo: string }> {
    const documento = await this.findOneOrThrow(organizationId, id);
    const documentoFiscal = documento.documentoJson as unknown as DocumentoFiscal;

    const [organization, contraparte] = await Promise.all([
      this.tx.organization.findFirstOrThrow({ where: { id: organizationId } }),
      this.tx.counterparty.findFirst({ where: { id: documento.contraparteId, organizationId } }),
    ]);
    const emitente = { cnpj: organization.taxId ?? "00000000000000", razaoSocial: organization.name };
    const destinatario = {
      documento: contraparte?.taxId ?? "00000000000000",
      razaoSocial: contraparte?.name ?? "NAO IDENTIFICADO",
    };

    if (documento.tipo === "NFE" || documento.tipo === "NFCE") {
      return { nomeArquivo: `${documento.numeroDocumento}-nfe.xml`, conteudo: gerarXmlNfe(documentoFiscal, emitente, destinatario) };
    }
    if (documento.tipo === "NFSE_NACIONAL" || documento.tipo === "NFSE_VIA") {
      return { nomeArquivo: `${documento.numeroDocumento}-nfse.xml`, conteudo: gerarXmlNfse(documentoFiscal, emitente, destinatario) };
    }
    throw new ConflictException(`Não há gerador de XML para o tipo de documento "${documento.tipo}".`);
  }
}
