import type { AccountType } from "./accounting";

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  openingBalance: number;
  periodDebit: number;
  periodCredit: number;
  closingBalance: number;
}

export interface TrialBalanceReport {
  startDate: string;
  endDate: string;
  rows: TrialBalanceRow[];
}

export interface GeneralLedgerLine {
  journalEntryId: string;
  entryNumber: string;
  entryDate: string;
  competenceDate: string;
  description: string;
  direction: "DEBIT" | "CREDIT";
  amount: number;
  runningBalance: number;
}

export interface GeneralLedgerReport {
  account: { id: string; code: string; name: string; type: AccountType };
  startDate: string;
  endDate: string;
  openingBalance: number;
  closingBalance: number;
  rows: GeneralLedgerLine[];
}

export interface IncomeStatementLine {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  amount: number;
}

export interface IncomeStatementReport {
  startDate: string;
  endDate: string;
  revenue: IncomeStatementLine[];
  expense: IncomeStatementLine[];
  totalRevenue: number;
  totalExpense: number;
  netResult: number;
}

export interface BalanceSheetLine {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  amount: number;
}

export interface BalanceSheetReport {
  asOfDate: string;
  assets: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
  equity: BalanceSheetLine[];
  netIncome: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

export interface CashFlowLine {
  journalEntryId: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  referenceModule: string;
  amount: number;
}

export interface CashFlowCategory {
  lines: CashFlowLine[];
  total: number;
}

export interface LegalGroupLine {
  accountId: string;
  code: string;
  name: string;
  amount: number;
}

export interface LegalGroupResult {
  key: string;
  label: string;
  lines: LegalGroupLine[];
  total: number;
}

export interface IncomeStatementLegalReport {
  startDate: string;
  endDate: string;
  contasSemClassificacao: string[];
  receitaBruta: LegalGroupResult;
  deducoesReceita: LegalGroupResult;
  receitaLiquida: number;
  custoMercadoriasServicos: LegalGroupResult;
  lucroBruto: number;
  despesasVendas: LegalGroupResult;
  despesasAdministrativas: LegalGroupResult;
  outrasReceitasOperacionais: LegalGroupResult;
  outrasDespesasOperacionais: LegalGroupResult;
  resultadoOperacional: number;
  receitasFinanceiras: LegalGroupResult;
  despesasFinanceiras: LegalGroupResult;
  resultadoAntesTributos: number;
  irpjCsll: LegalGroupResult;
  lucroLiquido: number;
}

export interface BalanceSheetLegalReport {
  asOfDate: string;
  contasSemClassificacao: string[];
  ativoCirculante: LegalGroupResult;
  ativoNaoCirculante: {
    realizavelLongoPrazo: LegalGroupResult;
    investimentos: LegalGroupResult;
    imobilizado: LegalGroupResult;
    intangivel: LegalGroupResult;
    total: number;
  };
  totalAtivo: number;
  passivoCirculante: LegalGroupResult;
  passivoNaoCirculante: LegalGroupResult;
  patrimonioLiquido: {
    capitalSocial: LegalGroupResult;
    reservasCapital: LegalGroupResult;
    reservasLucros: LegalGroupResult;
    lucrosAcumulados: LegalGroupResult;
    resultadoDoExercicio: number;
    total: number;
  };
  totalPassivoMaisPatrimonioLiquido: number;
}

export interface CashFlowReport {
  startDate: string;
  endDate: string;
  contasCaixa: { id: string; name: string; kind: "BANK" | "CASH"; accountCode: string }[];
  openingBalance: number;
  closingBalance: number;
  operating: CashFlowCategory;
  investing: CashFlowCategory;
  financing: CashFlowCategory;
  netChange: number;
}
