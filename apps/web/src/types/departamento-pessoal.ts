export type EmployeeStatus = "ACTIVE" | "TERMINATED";

export interface Employee {
  id: string;
  organizationId: string;
  registrationNumber: string;
  fullName: string;
  cpf: string;
  admissionDate: string;
  terminationDate: string | null;
  position: string;
  costCenterId: string | null;
  baseSalary: string;
  dependentsCount: number;
  transportVoucherMonthlyValue: string | null;
  mealVoucherMonthlyValue: string | null;
  mealVoucherDiscountRate: string | null;
  status: EmployeeStatus;
  createdAt: string;
  updatedAt: string;
  costCenter?: { id: string; code: string; name: string } | null;
}

export interface CreateEmployeeInput {
  fullName: string;
  cpf: string;
  admissionDate: string;
  position: string;
  costCenterId?: string;
  baseSalary: number;
  dependentsCount?: number;
  transportVoucherMonthlyValue?: number;
  mealVoucherMonthlyValue?: number;
  mealVoucherDiscountRate?: number;
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

export type TaxBracketType = "INSS" | "IRRF";

export interface PayrollTaxBracket {
  id: string;
  type: TaxBracketType;
  minBase: string;
  maxBase: string | null;
  rate: string;
  deduction: string;
}

export interface PayrollSettings {
  id: string;
  organizationId: string;
  irrfDependentDeduction: string;
  inssCeiling: string;
  fgtsRate: string;
  employerInssRate: string;
  fgtsFineRateWithoutCause: string;
  fgtsFineRateMutualAgreement: string;
  transportVoucherMaxDiscountRate: string;
  salaryExpenseAccountId: string | null;
  salaryPayableAccountId: string | null;
  inssPayableAccountId: string | null;
  irrfPayableAccountId: string | null;
  employerChargesExpenseAccountId: string | null;
  fgtsPayableAccountId: string | null;
  employerInssPayableAccountId: string | null;
  benefitsExpenseAccountId: string | null;
  benefitsPayableAccountId: string | null;
  fgtsFineExpenseAccountId: string | null;
  fgtsFinePayableAccountId: string | null;
  taxBrackets: PayrollTaxBracket[];
}

export interface UpdatePayrollSettingsInput {
  irrfDependentDeduction?: number;
  inssCeiling?: number;
  fgtsRate?: number;
  employerInssRate?: number;
  fgtsFineRateWithoutCause?: number;
  fgtsFineRateMutualAgreement?: number;
  transportVoucherMaxDiscountRate?: number;
  salaryExpenseAccountId?: string;
  salaryPayableAccountId?: string;
  inssPayableAccountId?: string;
  irrfPayableAccountId?: string;
  employerChargesExpenseAccountId?: string;
  fgtsPayableAccountId?: string;
  employerInssPayableAccountId?: string;
  benefitsExpenseAccountId?: string;
  benefitsPayableAccountId?: string;
  fgtsFineExpenseAccountId?: string;
  fgtsFinePayableAccountId?: string;
}

export interface SetTaxBracketsInput {
  type: TaxBracketType;
  brackets: { minBase: number; maxBase?: number; rate: number; deduction: number }[];
}

export type PayrollEventStatus = "DRAFT" | "CALCULATED" | "POSTED";

export interface PayrollRunLine {
  id: string;
  employeeId: string;
  baseSalary: string;
  inssAmount: string;
  irrfAmount: string;
  fgtsAmount: string;
  employerInssAmount: string;
  transportVoucherDiscount: string;
  mealVoucherBenefit: string;
  mealVoucherDiscount: string;
  netPay: string;
  employee: Employee;
}

export interface PayrollRun {
  id: string;
  organizationId: string;
  runNumber: string;
  competenceYear: number;
  competenceMonth: number;
  status: PayrollEventStatus;
  journalEntryId: string | null;
  createdAt: string;
  postedAt: string | null;
  lines?: PayrollRunLine[];
}

export interface CreatePayrollRunInput {
  competenceYear: number;
  competenceMonth: number;
}

export interface Vacation {
  id: string;
  organizationId: string;
  employeeId: string;
  acquisitionPeriodStart: string;
  acquisitionPeriodEnd: string;
  startDate: string;
  daysTaken: number;
  daysSold: number;
  status: PayrollEventStatus;
  vacationPay: string | null;
  constitutionalBonus: string | null;
  sellBonus: string | null;
  sellBonusConstitutionalBonus: string | null;
  inssAmount: string | null;
  irrfAmount: string | null;
  fgtsAmount: string | null;
  employerInssAmount: string | null;
  netPay: string | null;
  journalEntryId: string | null;
  createdAt: string;
  postedAt: string | null;
  employee: Employee;
}

export interface CreateVacationInput {
  employeeId: string;
  acquisitionPeriodStart: string;
  acquisitionPeriodEnd: string;
  startDate: string;
  daysTaken: number;
  daysSold: number;
}

export type ThirteenthSalaryInstallment = "FIRST" | "SECOND" | "SINGLE";

export interface ThirteenthSalaryRunLine {
  id: string;
  employeeId: string;
  monthsWorked: number;
  grossAmount: string;
  previousInstallmentAmount: string;
  inssAmount: string;
  irrfAmount: string;
  fgtsAmount: string;
  employerInssAmount: string;
  netPay: string;
  employee: Employee;
}

export interface ThirteenthSalaryRun {
  id: string;
  organizationId: string;
  runNumber: string;
  year: number;
  installment: ThirteenthSalaryInstallment;
  status: PayrollEventStatus;
  journalEntryId: string | null;
  createdAt: string;
  postedAt: string | null;
  lines?: ThirteenthSalaryRunLine[];
}

export interface CreateThirteenthSalaryRunInput {
  year: number;
  installment: ThirteenthSalaryInstallment;
}

export type TerminationType = "WITHOUT_CAUSE" | "RESIGNATION" | "WITH_CAUSE" | "MUTUAL_AGREEMENT";

export interface Termination {
  id: string;
  organizationId: string;
  employeeId: string;
  terminationDate: string;
  type: TerminationType;
  status: PayrollEventStatus;
  noticeDays: number | null;
  balanceSalaryAmount: string | null;
  noticeIndemnityAmount: string | null;
  proportionalThirteenthAmount: string | null;
  vestedVacationAmount: string | null;
  proportionalVacationAmount: string | null;
  vacationConstitutionalBonus: string | null;
  fgtsFineAmount: string | null;
  inssAmount: string | null;
  irrfAmount: string | null;
  netPay: string | null;
  journalEntryId: string | null;
  createdAt: string;
  postedAt: string | null;
  employee: Employee;
}

export interface CreateTerminationInput {
  employeeId: string;
  terminationDate: string;
  type: TerminationType;
  vestedVacationAmount?: number;
}
