import { AccountType } from "@prisma/client";

/**
 * Grupos do leiaute legal de Balanço Patrimonial (Lei 6.404/76 art. 178) e
 * DRE (art. 187), usados para montar `IncomeStatementLegalReport`/
 * `BalanceSheetLegalReport` a partir de `Account.legalStatementGroup`.
 * Simplificação assumida: Passivo Circulante/Não Circulante não abre em
 * subgrupos (fornecedores/empréstimos/obrigações trabalhistas/tributárias),
 * só o nível exigido pelo art. 178 — o mesmo raciocínio de "nível mínimo
 * legal, não o detalhamento gerencial completo" já usado no restante do
 * módulo de relatórios.
 */
export interface LegalStatementGroupDef {
  key: string;
  label: string;
}

export const LEGAL_STATEMENT_GROUPS_BY_TYPE: Record<AccountType, LegalStatementGroupDef[]> = {
  ASSET: [
    { key: "ATIVO_CIRCULANTE", label: "Ativo Circulante" },
    { key: "ATIVO_REALIZAVEL_LONGO_PRAZO", label: "Ativo Não Circulante — Realizável a Longo Prazo" },
    { key: "ATIVO_INVESTIMENTOS", label: "Ativo Não Circulante — Investimentos" },
    { key: "ATIVO_IMOBILIZADO", label: "Ativo Não Circulante — Imobilizado" },
    { key: "ATIVO_INTANGIVEL", label: "Ativo Não Circulante — Intangível" },
  ],
  LIABILITY: [
    { key: "PASSIVO_CIRCULANTE", label: "Passivo Circulante" },
    { key: "PASSIVO_NAO_CIRCULANTE", label: "Passivo Não Circulante" },
  ],
  EQUITY: [
    { key: "PL_CAPITAL_SOCIAL", label: "Patrimônio Líquido — Capital Social" },
    { key: "PL_RESERVAS_CAPITAL", label: "Patrimônio Líquido — Reservas de Capital" },
    { key: "PL_RESERVAS_LUCROS", label: "Patrimônio Líquido — Reservas de Lucros" },
    { key: "PL_LUCROS_ACUMULADOS", label: "Patrimônio Líquido — Lucros/Prejuízos Acumulados" },
  ],
  REVENUE: [
    { key: "RECEITA_BRUTA", label: "Receita Bruta de Vendas e Serviços" },
    { key: "DEDUCOES_RECEITA", label: "Deduções da Receita Bruta" },
    { key: "RECEITAS_FINANCEIRAS", label: "Receitas Financeiras" },
    { key: "OUTRAS_RECEITAS_OPERACIONAIS", label: "Outras Receitas Operacionais" },
  ],
  EXPENSE: [
    { key: "CUSTO_MERCADORIAS_SERVICOS", label: "Custo das Mercadorias/Serviços Vendidos" },
    { key: "DESPESAS_VENDAS", label: "Despesas com Vendas" },
    { key: "DESPESAS_ADMINISTRATIVAS", label: "Despesas Administrativas" },
    { key: "DESPESAS_FINANCEIRAS", label: "Despesas Financeiras" },
    { key: "OUTRAS_DESPESAS_OPERACIONAIS", label: "Outras Despesas Operacionais" },
    { key: "IRPJ_CSLL", label: "IRPJ e CSLL" },
  ],
};

export function isValidLegalStatementGroup(type: AccountType, group: string): boolean {
  return LEGAL_STATEMENT_GROUPS_BY_TYPE[type].some((g) => g.key === group);
}
