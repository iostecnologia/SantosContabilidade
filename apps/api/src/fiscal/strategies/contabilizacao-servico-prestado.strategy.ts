import { Injectable } from "@nestjs/common";
import { InterfaceContabilizacaoStrategy } from "../domain/contabilizacao-strategy.interface";
import { DocumentoFiscal, NaturezaOperacaoFiscal, TipoDocumentoFiscal } from "../domain/documento-fiscal";
import { LancamentoContabilRascunho, PartidaLancamento, TipoPartida } from "../domain/lancamento-contabil";
import { CategoriaContaFiscal, MapeamentoContabilFiscal } from "../domain/categoria-conta-fiscal";
import { ratearPorCentroCusto } from "../domain/rateio.util";

const TIPOS_SUPORTADOS = new Set([TipoDocumentoFiscal.NFSE_NACIONAL, TipoDocumentoFiscal.NFSE_VIA]);

/**
 * Serviço prestado (NFS-e): a empresa é a PRESTADORA — reconhece receita
 * bruta de serviços e a dedução tributária apurada (ISS/PIS/COFINS ou DAS
 * do Simples). Espelha ContabilizacaoVendaMercadoriaStrategy trocando
 * ICMS por ISS e as contas de receita/dedução de venda pelas de serviço.
 */
@Injectable()
export class ContabilizacaoServicoPrestadoStrategy implements InterfaceContabilizacaoStrategy {
  suporta(tipo: TipoDocumentoFiscal, natureza: NaturezaOperacaoFiscal): boolean {
    return TIPOS_SUPORTADOS.has(tipo) && natureza === NaturezaOperacaoFiscal.SERVICO_PRESTADO;
  }

  gerarLancamento(documento: DocumentoFiscal, mapeamento: MapeamentoContabilFiscal): LancamentoContabilRascunho {
    const partidas: PartidaLancamento[] = [];

    for (const grupo of ratearPorCentroCusto(documento.itens, documento.valorTotal, documento.centroCustoPadraoId)) {
      partidas.push({
        contaAnaliticaId: mapeamento.obterContaId(CategoriaContaFiscal.CLIENTES_A_RECEBER),
        centroCustoId: grupo.centroCustoId,
        tipo: TipoPartida.DEBITO,
        valor: grupo.valor,
        historicoComplementar: `NFS-e ${documento.numeroDocumento}`,
      });
    }
    for (const grupo of ratearPorCentroCusto(documento.itens, documento.valorTotal, documento.centroCustoPadraoId)) {
      partidas.push({
        contaAnaliticaId: mapeamento.obterContaId(CategoriaContaFiscal.RECEITA_SERVICOS),
        centroCustoId: grupo.centroCustoId,
        tipo: TipoPartida.CREDITO,
        valor: grupo.valor,
        historicoComplementar: `NFS-e ${documento.numeroDocumento}`,
      });
    }

    const impostos = documento.impostosApurados;
    if (impostos?.simplesNacionalDas && impostos.simplesNacionalDas > 0) {
      partidas.push({
        contaAnaliticaId: mapeamento.obterContaId(CategoriaContaFiscal.DEDUCOES_TRIBUTARIAS_SERVICOS),
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
      const totalTributos = (impostos.iss ?? 0) + (impostos.pis ?? 0) + (impostos.cofins ?? 0);
      if (totalTributos > 0) {
        partidas.push({
          contaAnaliticaId: mapeamento.obterContaId(CategoriaContaFiscal.DEDUCOES_TRIBUTARIAS_SERVICOS),
          tipo: TipoPartida.DEBITO,
          valor: totalTributos,
          historicoComplementar: `Tributos sobre serviço — ${documento.numeroDocumento}`,
        });
        this.adicionarCredito(partidas, mapeamento, CategoriaContaFiscal.ISS_A_RECOLHER, impostos.iss, documento);
        this.adicionarCredito(partidas, mapeamento, CategoriaContaFiscal.PIS_A_RECOLHER, impostos.pis, documento);
        this.adicionarCredito(partidas, mapeamento, CategoriaContaFiscal.COFINS_A_RECOLHER, impostos.cofins, documento);
      }
    }

    return {
      descricao: `NFS-e ${documento.numeroDocumento} — serviço prestado`,
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
