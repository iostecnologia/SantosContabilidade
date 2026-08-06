import { BadRequestException, Injectable } from "@nestjs/common";
import { InterfaceContabilizacaoStrategy } from "./domain/contabilizacao-strategy.interface";
import { DocumentoFiscal } from "./domain/documento-fiscal";
import { LancamentoContabilRascunho, TipoPartida } from "./domain/lancamento-contabil";
import { MapeamentoContabilFiscal } from "./domain/categoria-conta-fiscal";
import { DesbalanceamentoContabilError } from "./domain/desbalanceamento-contabil.error";
import { ContabilizacaoNfseServicoStrategy } from "./strategies/contabilizacao-nfse-servico.strategy";
import { ContabilizacaoCbsIbsStrategy } from "./strategies/contabilizacao-cbs-ibs.strategy";

/**
 * Motor/Factory do Strategy Pattern: recebe um documento fiscal, encontra a
 * estratégia de contabilização correspondente ao seu tipo, executa e valida
 * que débito = crédito ANTES de qualquer persistência. Novas estratégias se
 * registram aqui — nenhum outro ponto do módulo precisa saber quantas ou
 * quais existem.
 */
@Injectable()
export class ContextoContabilFiscal {
  private readonly estrategias: InterfaceContabilizacaoStrategy[];

  constructor(nfseServico: ContabilizacaoNfseServicoStrategy, cbsIbs: ContabilizacaoCbsIbsStrategy) {
    this.estrategias = [nfseServico, cbsIbs];
  }

  gerarRascunho(documento: DocumentoFiscal, mapeamento: MapeamentoContabilFiscal): LancamentoContabilRascunho {
    const estrategia = this.estrategias.find((e) => e.suporta(documento.tipo));
    if (!estrategia) {
      throw new BadRequestException(
        `Não há estratégia de contabilização registrada para o tipo de documento "${documento.tipo}".`,
      );
    }

    const rascunho = estrategia.gerarLancamento(documento, mapeamento);
    this.validarBalanceamento(rascunho);
    return rascunho;
  }

  private validarBalanceamento(rascunho: LancamentoContabilRascunho): void {
    if (rascunho.partidas.length < 2) {
      throw new DesbalanceamentoContabilError("O lançamento gerado precisa de ao menos duas partidas.");
    }

    let debito = 0;
    let credito = 0;
    for (const partida of rascunho.partidas) {
      if (partida.valor <= 0) {
        throw new DesbalanceamentoContabilError(`Partida com valor inválido: ${partida.valor}.`);
      }
      if (partida.tipo === TipoPartida.DEBITO) {
        debito += partida.valor;
      } else {
        credito += partida.valor;
      }
    }

    if (Math.abs(debito - credito) > 0.005) {
      throw new DesbalanceamentoContabilError(
        `Lançamento fiscal desbalanceado: débitos ${debito.toFixed(2)} ≠ créditos ${credito.toFixed(2)}.`,
      );
    }
  }
}
