export enum TipoPartida {
  DEBITO = "DEBITO",
  CREDITO = "CREDITO",
}

/**
 * Partida de um lançamento em rascunho: sempre aponta para conta analítica
 * (nunca sintética) — a garantia final disso é o trigger de postabilidade
 * no banco (ver módulo journal-entries), esta é só a intenção do domínio.
 */
export interface PartidaLancamento {
  contaAnaliticaId: string;
  centroCustoId?: string;
  tipo: TipoPartida;
  valor: number;
  historicoComplementar?: string;
}

export interface LancamentoContabilRascunho {
  descricao: string;
  partidas: PartidaLancamento[];
}
