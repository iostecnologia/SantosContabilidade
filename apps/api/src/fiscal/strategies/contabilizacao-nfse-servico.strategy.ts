import { Injectable } from "@nestjs/common";
import { InterfaceContabilizacaoStrategy } from "../domain/contabilizacao-strategy.interface";
import { DocumentoFiscal, NaturezaOperacaoFiscal, TipoDocumentoFiscal } from "../domain/documento-fiscal";
import { LancamentoContabilRascunho, PartidaLancamento, TipoPartida } from "../domain/lancamento-contabil";
import { CategoriaContaFiscal, MapeamentoContabilFiscal } from "../domain/categoria-conta-fiscal";
import { ratearPorCentroCusto } from "../domain/rateio.util";

const TIPOS_SUPORTADOS = new Set([TipoDocumentoFiscal.NFSE_NACIONAL, TipoDocumentoFiscal.NFSE_VIA]);

/**
 * NFS-e de serviço tomado: a empresa é a TOMADORA do serviço (gera
 * despesa), paga ao prestador o valor líquido de retenções na fonte, e
 * assume a obrigação de recolher essas retenções ao fisco/INSS em nome dele.
 */
@Injectable()
export class ContabilizacaoNfseServicoStrategy implements InterfaceContabilizacaoStrategy {
  suporta(tipo: TipoDocumentoFiscal, natureza: NaturezaOperacaoFiscal): boolean {
    return TIPOS_SUPORTADOS.has(tipo) && natureza === NaturezaOperacaoFiscal.SERVICO_TOMADO;
  }

  gerarLancamento(documento: DocumentoFiscal, mapeamento: MapeamentoContabilFiscal): LancamentoContabilRascunho {
    // suporta() já filtra isto no despacho normal via ContextoContabilFiscal;
    // mantido aqui como guarda defensiva para quem chamar a estratégia direto.
    if (documento.naturezaOperacao !== NaturezaOperacaoFiscal.SERVICO_TOMADO) {
      throw new Error(
        `ContabilizacaoNfseServicoStrategy só contabiliza SERVICO_TOMADO; recebido: ${documento.naturezaOperacao}`,
      );
    }

    const retencoes = documento.retencoes ?? {};
    const totalRetencoes =
      (retencoes.irrf ?? 0) +
      (retencoes.csll ?? 0) +
      (retencoes.pis ?? 0) +
      (retencoes.cofins ?? 0) +
      (retencoes.iss ?? 0) +
      (retencoes.inss ?? 0);

    const valorLiquidoFornecedor = documento.valorTotal - totalRetencoes;
    const partidas: PartidaLancamento[] = [];

    for (const grupo of ratearPorCentroCusto(documento.itens, documento.valorTotal, documento.centroCustoPadraoId)) {
      partidas.push({
        contaAnaliticaId: mapeamento.obterContaId(CategoriaContaFiscal.DESPESA_OPERACIONAL),
        centroCustoId: grupo.centroCustoId,
        tipo: TipoPartida.DEBITO,
        valor: grupo.valor,
        historicoComplementar: `NFS-e ${documento.numeroDocumento}`,
      });
    }

    if (valorLiquidoFornecedor > 0) {
      partidas.push({
        contaAnaliticaId: mapeamento.obterContaId(CategoriaContaFiscal.FORNECEDORES_A_PAGAR),
        tipo: TipoPartida.CREDITO,
        valor: valorLiquidoFornecedor,
        historicoComplementar: `NFS-e ${documento.numeroDocumento} — líquido a pagar`,
      });
    }

    this.adicionarRetencao(partidas, mapeamento, CategoriaContaFiscal.IRRF_A_RECOLHER, retencoes.irrf, documento);
    this.adicionarRetencao(partidas, mapeamento, CategoriaContaFiscal.CSLL_A_RECOLHER, retencoes.csll, documento);
    this.adicionarRetencao(partidas, mapeamento, CategoriaContaFiscal.PIS_A_RECOLHER, retencoes.pis, documento);
    this.adicionarRetencao(partidas, mapeamento, CategoriaContaFiscal.COFINS_A_RECOLHER, retencoes.cofins, documento);
    this.adicionarRetencao(partidas, mapeamento, CategoriaContaFiscal.ISS_A_RECOLHER, retencoes.iss, documento);
    this.adicionarRetencao(partidas, mapeamento, CategoriaContaFiscal.INSS_A_RECOLHER, retencoes.inss, documento);

    return {
      descricao: `NFS-e ${documento.numeroDocumento} — serviço tomado`,
      partidas,
    };
  }

  private adicionarRetencao(
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
      historicoComplementar: `Retenção NFS-e ${documento.numeroDocumento}`,
    });
  }
}
