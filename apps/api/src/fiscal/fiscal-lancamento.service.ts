import { Injectable } from "@nestjs/common";
import { JournalEntriesService } from "../journal-entries/journal-entries.service";
import { ContextoContabilFiscal } from "./contexto-contabil-fiscal.service";
import { ApuracaoTributariaService } from "./apuracao-tributaria.service";
import { DocumentoFiscal, NaturezaOperacaoFiscal } from "./domain/documento-fiscal";
import { LancamentoContabilRascunho, TipoPartida } from "./domain/lancamento-contabil";
import { CategoriaContaFiscal, MapeamentoContabilFiscalSimples } from "./domain/categoria-conta-fiscal";

const NATUREZAS_COM_APURACAO_AUTOMATICA = new Set([
  NaturezaOperacaoFiscal.VENDA_MERCADORIA,
  NaturezaOperacaoFiscal.SERVICO_PRESTADO,
]);

/**
 * Ponte entre o domínio fiscal (puro, sem I/O) e a persistência real de
 * lançamentos contábeis já construída no módulo journal-entries — reaproveita
 * toda a garantia de integridade de lá (RLS, numeração atômica, triggers de
 * postabilidade/balanceamento no banco). O balanceamento checado aqui
 * (ContextoContabilFiscal) é a validação rápida do domínio; o trigger no
 * Postgres é a garantia final, igual ao resto do sistema.
 */
@Injectable()
export class FiscalLancamentoService {
  constructor(
    private readonly contexto: ContextoContabilFiscal,
    private readonly journalEntries: JournalEntriesService,
    private readonly apuracaoTributaria: ApuracaoTributariaService,
  ) {}

  // Preenche `documento.impostosApurados` automaticamente quando a natureza
  // pede apuração (venda/serviço prestado) e o chamador não informou um
  // valor já calculado — é o que torna o cálculo "automático" de verdade,
  // em vez de depender do front-end lembrar de chamar a apuração antes.
  async apurarSeNecessario(organizationId: string, documento: DocumentoFiscal): Promise<DocumentoFiscal> {
    if (documento.impostosApurados || !NATUREZAS_COM_APURACAO_AUTOMATICA.has(documento.naturezaOperacao)) {
      return documento;
    }
    const impostosApurados = await this.apuracaoTributaria.apurar(organizationId, documento.naturezaOperacao, documento.itens);
    return { ...documento, impostosApurados };
  }

  gerarRascunho(
    documento: DocumentoFiscal,
    mapeamentoContabil: Record<string, string>,
  ): LancamentoContabilRascunho {
    const mapeamento = new MapeamentoContabilFiscalSimples(mapeamentoContabil as Partial<Record<CategoriaContaFiscal, string>>);
    return this.contexto.gerarRascunho(documento, mapeamento);
  }

  async lancar(
    organizationId: string,
    userId: string,
    documentoOriginal: DocumentoFiscal,
    mapeamentoContabil: Record<string, string>,
  ) {
    const documento = await this.apurarSeNecessario(organizationId, documentoOriginal);
    const rascunho = this.gerarRascunho(documento, mapeamentoContabil);

    return this.journalEntries.create(organizationId, userId, {
      entryDate: documento.dataEmissao,
      competenceDate: documento.dataCompetencia,
      description: rascunho.descricao,
      referenceModule: "FISCAL",
      referenceId: documento.id,
      lines: rascunho.partidas.map((partida) => ({
        accountId: partida.contaAnaliticaId,
        costCenterId: partida.centroCustoId,
        direction: partida.tipo === TipoPartida.DEBITO ? "DEBIT" : "CREDIT",
        amount: partida.valor,
      })),
    });
  }
}
