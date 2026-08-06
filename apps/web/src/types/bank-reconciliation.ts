import type { JournalEntry, JournalEntryLine } from "./accounting";
import type { BankAccount } from "./financeiro";

export type BankReconciliationStatus = "OPEN" | "CLOSED";
export type BankStatementLineStatus = "PENDING" | "MATCHED" | "ADJUSTED" | "IGNORED";

export interface BankStatementLine {
  id: string;
  organizationId: string;
  bankReconciliationId: string;
  bankAccountId: string;
  transactionDate: string;
  amount: string;
  description: string;
  fitId: string | null;
  status: BankStatementLineStatus;
  matchedJournalEntryLineId: string | null;
  createdAt: string;
  matchedJournalEntryLine?: (JournalEntryLine & { journalEntry: JournalEntry }) | null;
}

export interface BankReconciliation {
  id: string;
  organizationId: string;
  bankAccountId: string;
  periodStart: string;
  periodEnd: string;
  statementClosingBalance: string;
  status: BankReconciliationStatus;
  createdBy: string;
  createdAt: string;
  closedAt: string | null;
  bankAccount: BankAccount;
  lines?: BankStatementLine[];
}

export interface BankReconciliationSummary {
  statementClosingBalance: number;
  systemBalance: number;
  difference: number;
  pendingCount: number;
  canClose: boolean;
}

export interface CreateAdjustmentEntryInput {
  contraAccountId: string;
  costCenterId?: string;
  description?: string;
}
