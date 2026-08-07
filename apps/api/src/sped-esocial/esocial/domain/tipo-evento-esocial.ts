/**
 * Subconjunto de eventos do eSocial coberto por este módulo — escolhido por
 * ser o que já tem dado de origem no sistema (Departamento Pessoal). Fora de
 * escopo nesta rodada, documentado como simplificação: S-2206 (alteração
 * contratual), S-1210 (pagamentos), S-1298/S-1299 (fechamento), e todos os
 * eventos de saúde/segurança do trabalho (S-2210/S-2220/S-2240).
 */
export enum TipoEventoEsocial {
  S_1000_INFO_EMPREGADOR = "S-1000",
  S_1005_ESTABELECIMENTOS = "S-1005",
  S_1200_REMUNERACAO = "S-1200",
  S_2200_ADMISSAO = "S-2200",
  S_2230_AFASTAMENTO = "S-2230",
  S_2299_DESLIGAMENTO = "S-2299",
}

/** Ambiente fixo em "produção restrita" (2) — este sistema nunca transmite ao ambiente real (1). */
export const TP_AMB_PRODUCAO_RESTRITA = "2";
