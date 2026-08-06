export type CounterpartyType = "SUPPLIER" | "CUSTOMER" | "BOTH";

export interface Counterparty {
  id: string;
  organizationId: string;
  type: CounterpartyType;
  taxId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCounterpartyInput {
  type: CounterpartyType;
  taxId?: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface UpdateCounterpartyInput {
  type?: CounterpartyType;
  name?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
}

export type BankAccountKind = "BANK" | "CASH";

export interface BankAccount {
  id: string;
  organizationId: string;
  kind: BankAccountKind;
  name: string;
  bankCode: string | null;
  agency: string | null;
  accountNumber: string | null;
  glAccountId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankAccountInput {
  kind: BankAccountKind;
  name: string;
  bankCode?: string;
  agency?: string;
  accountNumber?: string;
  glAccountId: string;
}

export interface UpdateBankAccountInput {
  name?: string;
  bankCode?: string;
  agency?: string;
  accountNumber?: string;
  isActive?: boolean;
}

export type TitleStatus = "OPEN" | "PARTIALLY_PAID" | "PAID" | "CANCELED";

export interface AccountsPayablePayment {
  id: string;
  organizationId: string;
  accountsPayableId: string;
  paymentDate: string;
  amount: string;
  bankAccountId: string;
  journalEntryId: string;
  createdBy: string;
  createdAt: string;
}

export interface AccountsPayable {
  id: string;
  organizationId: string;
  documentNumber: string;
  counterpartyId: string;
  description: string;
  issueDate: string;
  dueDate: string;
  competenceDate: string;
  originalAmount: string;
  paidAmount: string;
  expenseAccountId: string;
  liabilityAccountId: string;
  costCenterId: string | null;
  status: TitleStatus;
  accrualJournalEntryId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  payments: AccountsPayablePayment[];
}

export interface CreateAccountsPayableInput {
  counterpartyId: string;
  description: string;
  issueDate: string;
  dueDate: string;
  competenceDate: string;
  originalAmount: number;
  expenseAccountId: string;
  liabilityAccountId: string;
  costCenterId?: string;
}

export interface RegisterPaymentInput {
  paymentDate: string;
  amount: number;
  bankAccountId: string;
}

export interface AccountsReceivableReceipt {
  id: string;
  organizationId: string;
  accountsReceivableId: string;
  receiptDate: string;
  amount: string;
  bankAccountId: string;
  journalEntryId: string;
  createdBy: string;
  createdAt: string;
}

export interface AccountsReceivable {
  id: string;
  organizationId: string;
  documentNumber: string;
  counterpartyId: string;
  description: string;
  issueDate: string;
  dueDate: string;
  competenceDate: string;
  originalAmount: string;
  receivedAmount: string;
  assetAccountId: string;
  revenueAccountId: string;
  costCenterId: string | null;
  status: TitleStatus;
  accrualJournalEntryId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  receipts: AccountsReceivableReceipt[];
}

export interface CreateAccountsReceivableInput {
  counterpartyId: string;
  description: string;
  issueDate: string;
  dueDate: string;
  competenceDate: string;
  originalAmount: number;
  assetAccountId: string;
  revenueAccountId: string;
  costCenterId?: string;
}

export interface RegisterReceiptInput {
  receiptDate: string;
  amount: number;
  bankAccountId: string;
}
