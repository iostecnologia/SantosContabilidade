export interface CostCenter {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCostCenterInput {
  code: string;
  name: string;
  parentId?: string;
}

export interface UpdateCostCenterInput {
  name?: string;
  isActive?: boolean;
}

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

export interface Account {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  isAnalytic: boolean;
  isActive: boolean;
  costCenterId: string | null;
  // Código do plano de contas referencial da RFB — usado por ECD (I051) e ECF (J051).
  spedReferenceCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountInput {
  code: string;
  name: string;
  type: AccountType;
  parentId?: string;
  costCenterId?: string;
}

export interface UpdateAccountInput {
  name?: string;
  isActive?: boolean;
  costCenterId?: string;
  spedReferenceCode?: string;
}

export type LineDirection = "DEBIT" | "CREDIT";

export interface JournalEntryLine {
  id: string;
  organizationId: string;
  journalEntryId: string;
  accountId: string;
  costCenterId: string | null;
  direction: LineDirection;
  amount: string;
  lineNumber: number;
}

export interface JournalEntry {
  id: string;
  organizationId: string;
  entryNumber: string;
  entryDate: string;
  competenceDate: string;
  description: string;
  referenceModule: string;
  referenceId: string | null;
  reversalOfId: string | null;
  createdBy: string;
  createdAt: string;
  lines: JournalEntryLine[];
}

export interface CreateJournalEntryLineInput {
  accountId: string;
  costCenterId?: string;
  direction: LineDirection;
  amount: number;
}

export interface CreateJournalEntryInput {
  entryDate: string;
  competenceDate: string;
  description: string;
  lines: CreateJournalEntryLineInput[];
}
