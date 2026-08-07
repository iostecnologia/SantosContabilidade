import { Injectable } from "@nestjs/common";
import { InterfaceContabilizacaoStrategy } from "../domain/contabilizacao-strategy.interface";
import { DocumentoFiscal, NaturezaOperacaoFiscal, TipoDocumentoFiscal } from "../domain/documento-fiscal";
import { LancamentoContabilRascunho, PartidaLancamento, TipoPartida } from "../domain/lancamento-contabil";
import { CategoriaContaFiscal, MapeamentoContabilFiscal } from "../domain/categoria-conta-fiscal";
import { ratearPorCentroCusto } from "../domain/rateio.util";

const TIPOS_SUPORTADOS = new Set([TipoDocumentoFiscal.NFE, TipoDocumentoFiscal.NFCE]);

/**
 * Venda de mercadoria (NF-e/NFC-e): a empresa é a VENDEDORA — reconhece
 * receita bruta pelo valor total e, junto, a dedução tributária apurada por
 * ApuracaoTributariaService (`documento.impostosApurados`, preenchido
 * automaticamente por FiscalLancamentoService antes de chamar esta
 * estratégia caso o chamador não tenha informado um valor já calculado).
 * Sem tributo apurado (documento sem `impostosApurados`), gera só o par
 * receita/cliente — usado quando a apuração automática esteja fora do
 * escopo do regime (ex.: operação isenta).
 */
@Injectable()
export class ContabilizacaoVendaMercadoriaStrategy implements InterfaceContabilizacaoStrategy {
  suporta(tipo: TipoDocumentoFiscal, natureza: NaturezaOperacaoFiscal): boolean {
    return TIPOS_SUPORTADOS.has(tipo) && natureza === NaturezaOperacaoFiscal.VENDA_MERCADORIA;
  }

  gerarLancamento(documento: DocumentoFiscal, mapeamento: MapeamentoContabilFiscal): LancamentoContabilRascunho {
    const partidas: PartidaLancamento[] = [];

    for (const grupo of ratearPorCentroCusto(documento.itens, documento.valorTotal, documento.centroCustoPadraoId)) {
      partidas.push({
        contaAnaliticaId: mapeamento.obterContaId(CategoriaContaFiscal.CLIENTES_A_RECEBER),
        centroCustoId: grupo.centroCustoId,
        tipo: TipoPartida.DEBITO,
        valor: grupo.valor,
        historicoComplementar: `NF-e ${documento.numeroDocumento}`,
      });
    }
    for (const grupo of ratearPorCentroCusto(documento.itens, documento.valorTotal, documento.centroCustoPadraoId)) {
      partidas.push({
        contaAnaliticaId: mapeamento.obterContaId(CategoriaContaFiscal.RECEITA_VENDAS),
        centroCustoId: grupo.centroCustoId,
        tipo: TipoPartida.CREDITO,
        valor: grupo.valor,
        historicoComplementar: `NF-e ${documento.numeroDocumento}`,
      });
    }

    const impostos = documento.impostosApurados;
    if (impostos?.simplesNacionalDas && impostos.simplesNacionalDas > 0) {
      partidas.push({
        contaAnaliticaId: mapeamento.obterContaId(CategoriaContaFiscal.DEDUCOES_TRIBUTARIAS_VENDAS),
        tipo: TipoPartida.DEBITO,
        valor: impostos.simplesNacionalDas,
        historicoComplementar: `Simples Nacional (DAS) — ${documento.numeroDocumento}`,
      });
      partidas.push({
        contaAnaliticaId: mapeamento.obterContaId(CategoriaContaFiscal.SIMPLES_NACIONAL_A_RECOLHER),
        tipo: TipoPartida.CREDITO,
        valor: impostos.simplesNacionalDas,
        historicoComplementar: `Simples Nacional (DAS) — ${documento.numeroDocumento}`,
      });
    } else if (impostos) {
      const totalTributos = (impostos.icms ?? 0) + (impostos.pis ?? 0) + (impostos.cofins ?? 0);
      if (totalTributos > 0) {
        partidas.push({
          contaAnaliticaId: mapeamento.obterContaId(CategoriaContaFiscal.DEDUCOES_TRIBUTARIAS_VENDAS),
          tipo: TipoPartida.DEBITO,
          valor: totalTributos,
          historicoComplementar: `Tributos sobre venda — ${documento.numeroDocumento}`,
        });
        this.adicionarCredito(partidas, mapeamento, CategoriaContaFiscal.ICMS_A_RECOLHER, impostos.icms, documento);
        this.adicionarCredito(partidas, mapeamento, CategoriaContaFiscal.PIS_A_RECOLHER, impostos.pis, documento);
        this.adicionarCredito(partidas, mapeamento, CategoriaContaFiscal.COFINS_A_RECOLHER, impostos.cofins, documento);
      }
    }

    return {
      descricao: `NF-e ${documento.numeroDocumento} — venda de mercadoria`,
      partidas,
    };
  }

  private adicionarCredito(
    partidas: PartidaLancamento[],
    mapeamento: MapeamentoContabilFiscal,
    categoria: CategoriaContaFiscal,
    valor: number | undefined,
    documento: DocumentoFiscal,
  ): void {
    if (!valor || valor <= 0) {
      return;
    }
    partidas.push({
      contaAnaliticaId: mapeamento.obterContaId(categoria),
      tipo: TipoPartida.CREDITO,
      valor,
      historicoComplementar: `${documento.numeroDocumento}`,
    });
  }
}
