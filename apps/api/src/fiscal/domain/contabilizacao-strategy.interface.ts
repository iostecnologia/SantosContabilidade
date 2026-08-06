import { DocumentoFiscal, TipoDocumentoFiscal } from "./documento-fiscal";
import { LancamentoContabilRascunho } from "./lancamento-contabil";
import { MapeamentoContabilFiscal } from "./categoria-conta-fiscal";

/**
 * Strategy Pattern: cada modelo/natureza de documento fiscal tem sua
 * própria lógica de contabilização (quais contas debitar/creditar, como
 * ratear por centro de custo, como tratar retenções). O ContextoContabilFiscal
 * escolhe a estratégia certa a partir de `suporta()`.
 */
export interface InterfaceContabilizacaoStrategy {
  suporta(tipo: TipoDocumentoFiscal): boolean;
  gerarLancamento(documento: DocumentoFiscal, mapeamento: MapeamentoContabilFiscal): LancamentoContabilRascunho;
}
