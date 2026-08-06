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
