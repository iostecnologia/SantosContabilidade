import { Injectable } from "@nestjs/common";
import { JournalEntriesService } from "../journal-entries/journal-entries.service";
import { ContextoContabilFiscal } from "./contexto-contabil-fiscal.service";
import { DocumentoFiscal } from "./domain/documento-fiscal";
import { LancamentoContabilRascunho, TipoPartida } from "./domain/lancamento-contabil";
import { CategoriaContaFiscal, MapeamentoContabilFiscalSimples } from "./domain/categoria-conta-fiscal";

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
  ) {}

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
    documento: DocumentoFiscal,
    mapeamentoContabil: Record<string, string>,
  ) {
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
