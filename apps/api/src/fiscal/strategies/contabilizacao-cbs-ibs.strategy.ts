import { Injectable } from "@nestjs/common";
import { InterfaceContabilizacaoStrategy } from "../domain/contabilizacao-strategy.interface";
import { DocumentoFiscal, NaturezaOperacaoFiscal, TipoDocumentoFiscal } from "../domain/documento-fiscal";
import { LancamentoContabilRascunho, PartidaLancamento, TipoPartida } from "../domain/lancamento-contabil";
import { CategoriaContaFiscal, MapeamentoContabilFiscal } from "../domain/categoria-conta-fiscal";
import { ratearPorCentroCusto } from "../domain/rateio.util";

const TIPOS_SUPORTADOS = new Set([TipoDocumentoFiscal.CBS, TipoDocumentoFiscal.IBS]);

/**
 * Documento com CBS/IBS retido na fonte pelo comprador (reforma
 * tributária): o comprador não repassa ao fornecedor a parcela de CBS/IBS
 * retida — assume a obrigação de recolhê-la diretamente — mas mantém o
 * direito ao crédito tributário não-cumulativo integral.
 *
 * Pressupõe `valorTributosRecuperaveis = cbsRetido + ibsRetido` (todo o
 * crédito recuperável deste documento corresponde ao valor retido). Um
 * documento que viole essa relação vai gerar um rascunho desbalanceado —
 * ContextoContabilFiscal.gerarRascunho rejeita antes de qualquer
 * persistência, comportamento correto diante de um dado fiscal inconsistente.
 */
@Injectable()
export class ContabilizacaoCbsIbsStrategy implements InterfaceContabilizacaoStrategy {
  suporta(tipo: TipoDocumentoFiscal): boolean {
    return TIPOS_SUPORTADOS.has(tipo);
  }

  gerarLancamento(documento: DocumentoFiscal, mapeamento: MapeamentoContabilFiscal): LancamentoContabilRascunho {
    const retencoes = documento.retencoes ?? {};
    const cbsRetido = retencoes.cbsRetido ?? 0;
    const ibsRetido = retencoes.ibsRetido ?? 0;
    const totalRetidoNaFonte = cbsRetido + ibsRetido;

    const valorLiquidoCusto = documento.valorTotal - (documento.valorTributosRecuperaveis ?? 0);
    const valorLiquidoFornecedor = documento.valorTotal - totalRetidoNaFonte;
    const contaCusto = this.contaCustoPara(documento.naturezaOperacao);

    const partidas: PartidaLancamento[] = [];

    for (const grupo of ratearPorCentroCusto(documento.itens, valorLiquidoCusto, documento.centroCustoPadraoId)) {
      partidas.push({
        contaAnaliticaId: mapeamento.obterContaId(contaCusto),
        centroCustoId: grupo.centroCustoId,
        tipo: TipoPartida.DEBITO,
        valor: grupo.valor,
        historicoComplementar: `${documento.tipo} ${documento.numeroDocumento}`,
      });
    }

    if (cbsRetido > 0) {
      partidas.push({
        contaAnaliticaId: mapeamento.obterContaId(CategoriaContaFiscal.CBS_A_RECUPERAR),
        tipo: TipoPartida.DEBITO,
        valor: cbsRetido,
        historicoComplementar: `CBS a recuperar — ${documento.numeroDocumento}`,
      });
    }
    if (ibsRetido > 0) {
      partidas.push({
        contaAnaliticaId: mapeamento.obterContaId(CategoriaContaFiscal.IBS_A_RECUPERAR),
        tipo: TipoPartida.DEBITO,
        valor: ibsRetido,
        historicoComplementar: `IBS a recuperar — ${documento.numeroDocumento}`,
      });
    }

    if (valorLiquidoFornecedor > 0) {
      partidas.push({
        contaAnaliticaId: mapeamento.obterContaId(CategoriaContaFiscal.FORNECEDORES_A_PAGAR),
        tipo: TipoPartida.CREDITO,
        valor: valorLiquidoFornecedor,
        historicoComplementar: `${documento.tipo} ${documento.numeroDocumento} — líquido a pagar`,
      });
    }

    if (cbsRetido > 0) {
      partidas.push({
        contaAnaliticaId: mapeamento.obterContaId(CategoriaContaFiscal.CBS_A_RECOLHER),
        tipo: TipoPartida.CREDITO,
        valor: cbsRetido,
        historicoComplementar: `CBS retido a recolher — ${documento.numeroDocumento}`,
      });
    }
    if (ibsRetido > 0) {
      partidas.push({
        contaAnaliticaId: mapeamento.obterContaId(CategoriaContaFiscal.IBS_A_RECOLHER),
        tipo: TipoPartida.CREDITO,
        valor: ibsRetido,
        historicoComplementar: `IBS retido a recolher — ${documento.numeroDocumento}`,
      });
    }

    return {
      descricao: `${documento.tipo} ${documento.numeroDocumento} — CBS/IBS retido na fonte`,
      partidas,
    };
  }

  private contaCustoPara(natureza: NaturezaOperacaoFiscal): CategoriaContaFiscal {
    switch (natureza) {
      case NaturezaOperacaoFiscal.COMPRA_ATIVO_IMOBILIZADO:
        return CategoriaContaFiscal.ATIVO_IMOBILIZADO;
      case NaturezaOperacaoFiscal.COMPRA_MERCADORIA:
        return CategoriaContaFiscal.ESTOQUE;
      default:
        return CategoriaContaFiscal.DESPESA_OPERACIONAL;
    }
  }
}
