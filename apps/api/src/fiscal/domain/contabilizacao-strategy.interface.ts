import { DocumentoFiscal, NaturezaOperacaoFiscal, TipoDocumentoFiscal } from "./documento-fiscal";
import { LancamentoContabilRascunho } from "./lancamento-contabil";
import { MapeamentoContabilFiscal } from "./categoria-conta-fiscal";

/**
 * Strategy Pattern: cada modelo/natureza de documento fiscal tem sua
 * própria lógica de contabilização (quais contas debitar/creditar, como
 * ratear por centro de custo, como tratar retenções). O ContextoContabilFiscal
 * escolhe a estratégia certa a partir de `suporta()`.
 *
 * `suporta` recebe tipo E natureza porque um mesmo `tipo` (ex.: NFSE_NACIONAL)
 * pode exigir contabilização oposta dependendo da natureza — SERVICO_TOMADO
 * é despesa (a empresa é tomadora), SERVICO_PRESTADO é receita (a empresa é
 * prestadora) — nenhuma estratégia consegue se registrar corretamente sem
 * enxergar os dois campos.
 */
export interface InterfaceContabilizacaoStrategy {
  suporta(tipo: TipoDocumentoFiscal, natureza: NaturezaOperacaoFiscal): boolean;
  gerarLancamento(documento: DocumentoFiscal, mapeamento: MapeamentoContabilFiscal): LancamentoContabilRascunho;
}
