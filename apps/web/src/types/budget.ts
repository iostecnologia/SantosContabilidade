export type BudgetStatus = "DRAFT" | "APPROVED" | "CLOSED";

export interface BudgetLine {
  id: string;
  organizationId: string;
  budgetPlanId: string;
  accountId: string;
  costCenterId: string;
  month: number;
  amount: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetPlan {
  id: string;
  organizationId: string;
  fiscalYear: number;
  name: string;
  status: BudgetStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  closedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lines: BudgetLine[];
}

export interface CreateBudgetPlanInput {
  fiscalYear: number;
  name: string;
}

export interface UpdateBudgetPlanInput {
  fiscalYear?: number;
  name?: string;
}

export interface CreateBudgetLineInput {
  accountId: string;
  costCenterId: string;
  month: number;
  amount: number;
}

export interface UpdateBudgetLineInput {
  amount: number;
}

export interface BudgetVarianceRow {
  accountId: string;
  costCenterId: string;
  month: number;
  budgeted: number;
  realized: number;
  variance: number;
}

export interface BudgetVarianceReport {
  plan: { id: string; fiscalYear: number; name: string; status: BudgetStatus };
  rows: BudgetVarianceRow[];
}
