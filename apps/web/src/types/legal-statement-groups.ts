import type { AccountType } from "./accounting";

// Espelha apps/api/src/reports/domain/legal-statement-groups.ts — mantidos em
// sincronia manualmente (é um domínio pequeno e estável, plano de contas legal
// não muda com frequência).
export const LEGAL_STATEMENT_GROUPS_BY_TYPE: Record<AccountType, { key: string; label: string }[]> = {
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
    { key: "PL_AJUSTES_AVALIACAO_PATRIMONIAL", label: "Patrimônio Líquido — Ajustes de Avaliação Patrimonial" },
    { key: "PL_RESERVAS_LUCROS", label: "Patrimônio Líquido — Reservas de Lucros" },
    { key: "PL_ACOES_TESOURARIA", label: "Patrimônio Líquido — Ações em Tesouraria" },
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
    { key: "PARTICIPACOES", label: "Participações (debêntures/empregados/administradores)" },
  ],
};
