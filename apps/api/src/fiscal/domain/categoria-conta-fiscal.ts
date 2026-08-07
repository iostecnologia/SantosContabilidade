import { BadRequestException } from "@nestjs/common";

/**
 * Categoria contábil abstrata que uma estratégia de contabilização usa para
 * pedir "a conta X da empresa", sem saber o código real do plano de contas
 * do tenant. Desacopla o domínio (puro, testável) de como o mapeamento é
 * armazenado — hoje vem explícito na requisição (MapeamentoContabilFiscalSimples);
 * amanhã pode virar um cadastro persistido por organização sem tocar nas estratégias.
 */
export enum CategoriaContaFiscal {
  DESPESA_OPERACIONAL = "DESPESA_OPERACIONAL",
  ATIVO_IMOBILIZADO = "ATIVO_IMOBILIZADO",
  ESTOQUE = "ESTOQUE",
  FORNECEDORES_A_PAGAR = "FORNECEDORES_A_PAGAR",
  CAIXA_BANCO = "CAIXA_BANCO",
  IRRF_A_RECOLHER = "IRRF_A_RECOLHER",
  CSLL_A_RECOLHER = "CSLL_A_RECOLHER",
  PIS_A_RECOLHER = "PIS_A_RECOLHER",
  COFINS_A_RECOLHER = "COFINS_A_RECOLHER",
  ISS_A_RECOLHER = "ISS_A_RECOLHER",
  INSS_A_RECOLHER = "INSS_A_RECOLHER",
  CBS_A_RECUPERAR = "CBS_A_RECUPERAR",
  IBS_A_RECUPERAR = "IBS_A_RECUPERAR",
  CBS_A_RECOLHER = "CBS_A_RECOLHER",
  IBS_A_RECOLHER = "IBS_A_RECOLHER",
  // Apuração automática de tributos sobre venda/serviço prestado (ver
  // ApuracaoTributariaService e as estratégias de venda/serviço prestado).
  RECEITA_VENDAS = "RECEITA_VENDAS",
  RECEITA_SERVICOS = "RECEITA_SERVICOS",
  CLIENTES_A_RECEBER = "CLIENTES_A_RECEBER",
  DEDUCOES_TRIBUTARIAS_VENDAS = "DEDUCOES_TRIBUTARIAS_VENDAS",
  DEDUCOES_TRIBUTARIAS_SERVICOS = "DEDUCOES_TRIBUTARIAS_SERVICOS",
  ICMS_A_RECOLHER = "ICMS_A_RECOLHER",
  SIMPLES_NACIONAL_A_RECOLHER = "SIMPLES_NACIONAL_A_RECOLHER",
}

export interface MapeamentoContabilFiscal {
  obterContaId(categoria: CategoriaContaFiscal): string;
}

export class MapeamentoContabilFiscalInvalidoError extends BadRequestException {
  constructor(categoria: CategoriaContaFiscal) {
    super(`Mapeamento contábil fiscal não configurado para a categoria "${categoria}".`);
  }
}

export class MapeamentoContabilFiscalSimples implements MapeamentoContabilFiscal {
  constructor(private readonly contas: Partial<Record<CategoriaContaFiscal, string>>) {}

  obterContaId(categoria: CategoriaContaFiscal): string {
    const contaId = this.contas[categoria];
    if (!contaId) {
      throw new MapeamentoContabilFiscalInvalidoError(categoria);
    }
    return contaId;
  }
}
