import { ContextoContabilFiscal } from "../../src/fiscal/contexto-contabil-fiscal.service";
import { ContabilizacaoNfseServicoStrategy } from "../../src/fiscal/strategies/contabilizacao-nfse-servico.strategy";
import { ContabilizacaoCbsIbsStrategy } from "../../src/fiscal/strategies/contabilizacao-cbs-ibs.strategy";
import { ContabilizacaoVendaMercadoriaStrategy } from "../../src/fiscal/strategies/contabilizacao-venda-mercadoria.strategy";
import { ContabilizacaoServicoPrestadoStrategy } from "../../src/fiscal/strategies/contabilizacao-servico-prestado.strategy";
import {
  CategoriaContaFiscal,
  MapeamentoContabilFiscalInvalidoError,
  MapeamentoContabilFiscalSimples,
} from "../../src/fiscal/domain/categoria-conta-fiscal";
import { DesbalanceamentoContabilError } from "../../src/fiscal/domain/desbalanceamento-contabil.error";
import { DocumentoFiscal, NaturezaOperacaoFiscal, TipoDocumentoFiscal } from "../../src/fiscal/domain/documento-fiscal";
import { TipoPartida } from "../../src/fiscal/domain/lancamento-contabil";
import { ratearPorCentroCusto } from "../../src/fiscal/domain/rateio.util";

function somaPorTipo(partidas: { tipo: TipoPartida; valor: number }[], tipo: TipoPartida): number {
  return partidas.filter((p) => p.tipo === tipo).reduce((acc, p) => acc + p.valor, 0);
}

const MAPEAMENTO_COMPLETO = new MapeamentoContabilFiscalSimples({
  [CategoriaContaFiscal.DESPESA_OPERACIONAL]: "conta-despesa",
  [CategoriaContaFiscal.ESTOQUE]: "conta-estoque",
  [CategoriaContaFiscal.ATIVO_IMOBILIZADO]: "conta-ativo-imobilizado",
  [CategoriaContaFiscal.FORNECEDORES_A_PAGAR]: "conta-fornecedores",
  [CategoriaContaFiscal.IRRF_A_RECOLHER]: "conta-irrf",
  [CategoriaContaFiscal.CSLL_A_RECOLHER]: "conta-csll",
  [CategoriaContaFiscal.PIS_A_RECOLHER]: "conta-pis",
  [CategoriaContaFiscal.COFINS_A_RECOLHER]: "conta-cofins",
  [CategoriaContaFiscal.ISS_A_RECOLHER]: "conta-iss",
  [CategoriaContaFiscal.INSS_A_RECOLHER]: "conta-inss",
  [CategoriaContaFiscal.CBS_A_RECUPERAR]: "conta-cbs-recuperar",
  [CategoriaContaFiscal.IBS_A_RECUPERAR]: "conta-ibs-recuperar",
  [CategoriaContaFiscal.CBS_A_RECOLHER]: "conta-cbs-recolher",
  [CategoriaContaFiscal.IBS_A_RECOLHER]: "conta-ibs-recolher",
});

describe("Módulo Fiscal — rateio por centro de custo", () => {
  it("distribui proporcionalmente e absorve o resíduo de centavos no último grupo", () => {
    const grupos = ratearPorCentroCusto(
      [
        { descricao: "Item 1", quantidade: 1, valorUnitario: 33.33, valorTotal: 33.33, centroCustoId: "cc-1" },
        { descricao: "Item 2", quantidade: 1, valorUnitario: 33.33, valorTotal: 33.33, centroCustoId: "cc-2" },
        { descricao: "Item 3", quantidade: 1, valorUnitario: 33.34, valorTotal: 33.34, centroCustoId: "cc-3" },
      ],
      100,
    );

    const soma = grupos.reduce((acc, g) => acc + g.valor, 0);
    expect(Math.round(soma * 100) / 100).toBe(100);
    expect(grupos).toHaveLength(3);
  });
});

describe("Módulo Fiscal — ContabilizacaoNfseServicoStrategy", () => {
  const strategy = new ContabilizacaoNfseServicoStrategy();

  it("gera lançamento balanceado com múltiplas retenções", () => {
    const documento: DocumentoFiscal = {
      id: "doc-1",
      tipo: TipoDocumentoFiscal.NFSE_NACIONAL,
      naturezaOperacao: NaturezaOperacaoFiscal.SERVICO_TOMADO,
      numeroDocumento: "12345",
      dataEmissao: "2026-08-06",
      dataCompetencia: "2026-08-06",
      fornecedorOuClienteId: "fornecedor-1",
      valorTotal: 1000,
      itens: [{ descricao: "Consultoria", quantidade: 1, valorUnitario: 1000, valorTotal: 1000, centroCustoId: "cc-adm" }],
      retencoes: { irrf: 15, csll: 10, pis: 6.5, cofins: 30, iss: 50 },
    };

    const rascunho = strategy.gerarLancamento(documento, MAPEAMENTO_COMPLETO);

    const debito = somaPorTipo(rascunho.partidas, TipoPartida.DEBITO);
    const credito = somaPorTipo(rascunho.partidas, TipoPartida.CREDITO);
    expect(debito).toBeCloseTo(1000, 2);
    expect(credito).toBeCloseTo(1000, 2);
    expect(debito).toBeCloseTo(credito, 6);

    // uma linha de despesa + fornecedor + 5 retenções
    expect(rascunho.partidas).toHaveLength(7);
  });

  it("rejeita documento com natureza de operação incompatível", () => {
    const documento: DocumentoFiscal = {
      id: "doc-2",
      tipo: TipoDocumentoFiscal.NFSE_NACIONAL,
      naturezaOperacao: NaturezaOperacaoFiscal.SERVICO_PRESTADO,
      numeroDocumento: "1",
      dataEmissao: "2026-08-06",
      dataCompetencia: "2026-08-06",
      fornecedorOuClienteId: "x",
      valorTotal: 100,
      itens: [{ descricao: "x", quantidade: 1, valorUnitario: 100, valorTotal: 100 }],
    };

    expect(() => strategy.gerarLancamento(documento, MAPEAMENTO_COMPLETO)).toThrow();
  });
});

describe("Módulo Fiscal — ContabilizacaoCbsIbsStrategy", () => {
  const strategy = new ContabilizacaoCbsIbsStrategy();

  it("gera lançamento balanceado com CBS/IBS retidos na fonte", () => {
    const documento: DocumentoFiscal = {
      id: "doc-3",
      tipo: TipoDocumentoFiscal.CBS,
      naturezaOperacao: NaturezaOperacaoFiscal.COMPRA_MERCADORIA,
      numeroDocumento: "999",
      dataEmissao: "2026-08-06",
      dataCompetencia: "2026-08-06",
      fornecedorOuClienteId: "fornecedor-2",
      valorTotal: 2000,
      valorTributosRecuperaveis: 180, // == cbsRetido + ibsRetido, invariante da estratégia
      itens: [
        { descricao: "Mercadoria A", quantidade: 1, valorUnitario: 1200, valorTotal: 1200, centroCustoId: "cc-1" },
        { descricao: "Mercadoria B", quantidade: 1, valorUnitario: 800, valorTotal: 800, centroCustoId: "cc-2" },
      ],
      retencoes: { cbsRetido: 100, ibsRetido: 80 },
    };

    const rascunho = strategy.gerarLancamento(documento, MAPEAMENTO_COMPLETO);

    const debito = somaPorTipo(rascunho.partidas, TipoPartida.DEBITO);
    const credito = somaPorTipo(rascunho.partidas, TipoPartida.CREDITO);
    expect(debito).toBeCloseTo(2000, 2);
    expect(credito).toBeCloseTo(2000, 2);
  });
});

describe("Módulo Fiscal — ContextoContabilFiscal (engine/Strategy dispatch)", () => {
  const contexto = new ContextoContabilFiscal(
    new ContabilizacaoNfseServicoStrategy(),
    new ContabilizacaoCbsIbsStrategy(),
    new ContabilizacaoVendaMercadoriaStrategy(),
    new ContabilizacaoServicoPrestadoStrategy(),
  );

  it("escolhe a estratégia certa por tipo de documento e valida o balanceamento", () => {
    const documento: DocumentoFiscal = {
      id: "doc-4",
      tipo: TipoDocumentoFiscal.NFSE_NACIONAL,
      naturezaOperacao: NaturezaOperacaoFiscal.SERVICO_TOMADO,
      numeroDocumento: "1",
      dataEmissao: "2026-08-06",
      dataCompetencia: "2026-08-06",
      fornecedorOuClienteId: "f",
      valorTotal: 500,
      itens: [{ descricao: "Serviço", quantidade: 1, valorUnitario: 500, valorTotal: 500 }],
    };

    const rascunho = contexto.gerarRascunho(documento, MAPEAMENTO_COMPLETO);
    expect(rascunho.partidas.length).toBeGreaterThanOrEqual(2);
  });

  it("lança DesbalanceamentoContabilError quando o crédito tributário não bate com a retenção (CBS/IBS)", () => {
    const documento: DocumentoFiscal = {
      id: "doc-5",
      tipo: TipoDocumentoFiscal.IBS,
      naturezaOperacao: NaturezaOperacaoFiscal.COMPRA_MERCADORIA,
      numeroDocumento: "2",
      dataEmissao: "2026-08-06",
      dataCompetencia: "2026-08-06",
      fornecedorOuClienteId: "f",
      valorTotal: 1000,
      valorTributosRecuperaveis: 50, // inconsistente: deveria ser 90 (cbsRetido+ibsRetido)
      itens: [{ descricao: "Item", quantidade: 1, valorUnitario: 1000, valorTotal: 1000 }],
      retencoes: { cbsRetido: 40, ibsRetido: 50 },
    };

    expect(() => contexto.gerarRascunho(documento, MAPEAMENTO_COMPLETO)).toThrow(DesbalanceamentoContabilError);
  });

  it("lança erro claro quando não há estratégia registrada para o tipo do documento", () => {
    const documento: DocumentoFiscal = {
      id: "doc-6",
      tipo: TipoDocumentoFiscal.MDFE,
      naturezaOperacao: NaturezaOperacaoFiscal.SERVICO_PRESTADO,
      numeroDocumento: "3",
      dataEmissao: "2026-08-06",
      dataCompetencia: "2026-08-06",
      fornecedorOuClienteId: "f",
      valorTotal: 100,
      itens: [{ descricao: "x", quantidade: 1, valorUnitario: 100, valorTotal: 100 }],
    };

    expect(() => contexto.gerarRascunho(documento, MAPEAMENTO_COMPLETO)).toThrow(/não há estratégia/i);
  });
});

describe("Módulo Fiscal — MapeamentoContabilFiscalSimples", () => {
  it("lança erro claro quando a categoria não está configurada", () => {
    const mapeamento = new MapeamentoContabilFiscalSimples({});
    expect(() => mapeamento.obterContaId(CategoriaContaFiscal.DESPESA_OPERACIONAL)).toThrow(
      MapeamentoContabilFiscalInvalidoError,
    );
  });
});
