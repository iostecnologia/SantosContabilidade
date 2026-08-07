-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "TaxBracketType" AS ENUM ('INSS', 'IRRF');

-- CreateEnum
CREATE TYPE "PayrollEventStatus" AS ENUM ('DRAFT', 'CALCULATED', 'POSTED');

-- CreateEnum
CREATE TYPE "ThirteenthSalaryInstallment" AS ENUM ('FIRST', 'SECOND', 'SINGLE');

-- CreateEnum
CREATE TYPE "TerminationType" AS ENUM ('WITHOUT_CAUSE', 'RESIGNATION', 'WITH_CAUSE', 'MUTUAL_AGREEMENT');

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "registration_number" BIGINT NOT NULL,
    "full_name" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "admission_date" DATE NOT NULL,
    "termination_date" DATE,
    "position" TEXT NOT NULL,
    "cost_center_id" TEXT,
    "base_salary" DECIMAL(18,2) NOT NULL,
    "dependents_count" INTEGER NOT NULL DEFAULT 0,
    "transport_voucher_monthly_value" DECIMAL(18,2),
    "meal_voucher_monthly_value" DECIMAL(18,2),
    "meal_voucher_discount_rate" DECIMAL(5,4),
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "irrf_dependent_deduction" DECIMAL(18,2) NOT NULL,
    "inss_ceiling" DECIMAL(18,2) NOT NULL,
    "fgts_rate" DECIMAL(5,4) NOT NULL,
    "employer_inss_rate" DECIMAL(5,4) NOT NULL,
    "fgts_fine_rate_without_cause" DECIMAL(5,4) NOT NULL,
    "fgts_fine_rate_mutual_agreement" DECIMAL(5,4) NOT NULL,
    "transport_voucher_max_discount_rate" DECIMAL(5,4) NOT NULL,
    "salary_expense_account_id" TEXT,
    "salary_payable_account_id" TEXT,
    "inss_payable_account_id" TEXT,
    "irrf_payable_account_id" TEXT,
    "employer_charges_expense_account_id" TEXT,
    "fgts_payable_account_id" TEXT,
    "employer_inss_payable_account_id" TEXT,
    "benefits_expense_account_id" TEXT,
    "benefits_payable_account_id" TEXT,
    "fgts_fine_expense_account_id" TEXT,
    "fgts_fine_payable_account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_tax_brackets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "payroll_settings_id" TEXT NOT NULL,
    "type" "TaxBracketType" NOT NULL,
    "min_base" DECIMAL(18,2) NOT NULL,
    "max_base" DECIMAL(18,2),
    "rate" DECIMAL(5,4) NOT NULL,
    "deduction" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "payroll_tax_brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "run_number" BIGINT NOT NULL,
    "competence_year" INTEGER NOT NULL,
    "competence_month" INTEGER NOT NULL,
    "status" "PayrollEventStatus" NOT NULL DEFAULT 'DRAFT',
    "journal_entry_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_at" TIMESTAMP(3),

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_run_lines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "payroll_run_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "base_salary" DECIMAL(18,2) NOT NULL,
    "inss_amount" DECIMAL(18,2) NOT NULL,
    "irrf_amount" DECIMAL(18,2) NOT NULL,
    "fgts_amount" DECIMAL(18,2) NOT NULL,
    "employer_inss_amount" DECIMAL(18,2) NOT NULL,
    "transport_voucher_discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "meal_voucher_benefit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "meal_voucher_discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_pay" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "payroll_run_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "acquisition_period_start" DATE NOT NULL,
    "acquisition_period_end" DATE NOT NULL,
    "start_date" DATE NOT NULL,
    "days_taken" INTEGER NOT NULL,
    "days_sold" INTEGER NOT NULL DEFAULT 0,
    "status" "PayrollEventStatus" NOT NULL DEFAULT 'DRAFT',
    "vacation_pay" DECIMAL(18,2),
    "constitutional_bonus" DECIMAL(18,2),
    "sell_bonus" DECIMAL(18,2),
    "sell_bonus_constitutional_bonus" DECIMAL(18,2),
    "inss_amount" DECIMAL(18,2),
    "irrf_amount" DECIMAL(18,2),
    "fgts_amount" DECIMAL(18,2),
    "employer_inss_amount" DECIMAL(18,2),
    "net_pay" DECIMAL(18,2),
    "journal_entry_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_at" TIMESTAMP(3),

    CONSTRAINT "vacations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thirteenth_salary_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "run_number" BIGINT NOT NULL,
    "year" INTEGER NOT NULL,
    "installment" "ThirteenthSalaryInstallment" NOT NULL,
    "status" "PayrollEventStatus" NOT NULL DEFAULT 'DRAFT',
    "journal_entry_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_at" TIMESTAMP(3),

    CONSTRAINT "thirteenth_salary_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thirteenth_salary_run_lines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "thirteenth_salary_run_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "months_worked" INTEGER NOT NULL,
    "gross_amount" DECIMAL(18,2) NOT NULL,
    "previous_installment_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "inss_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "irrf_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fgts_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "employer_inss_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_pay" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "thirteenth_salary_run_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terminations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "termination_date" DATE NOT NULL,
    "type" "TerminationType" NOT NULL,
    "status" "PayrollEventStatus" NOT NULL DEFAULT 'DRAFT',
    "notice_days" INTEGER,
    "balance_salary_amount" DECIMAL(18,2),
    "notice_indemnity_amount" DECIMAL(18,2),
    "proportional_thirteenth_amount" DECIMAL(18,2),
    "vested_vacation_amount" DECIMAL(18,2),
    "proportional_vacation_amount" DECIMAL(18,2),
    "vacation_constitutional_bonus" DECIMAL(18,2),
    "fgts_fine_amount" DECIMAL(18,2),
    "inss_amount" DECIMAL(18,2),
    "irrf_amount" DECIMAL(18,2),
    "net_pay" DECIMAL(18,2),
    "journal_entry_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_at" TIMESTAMP(3),

    CONSTRAINT "terminations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employees_organization_id_status_idx" ON "employees"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organization_id_registration_number_key" ON "employees"("organization_id", "registration_number");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organization_id_cpf_key" ON "employees"("organization_id", "cpf");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_settings_organization_id_key" ON "payroll_settings"("organization_id");

-- CreateIndex
CREATE INDEX "payroll_tax_brackets_organization_id_payroll_settings_id_ty_idx" ON "payroll_tax_brackets"("organization_id", "payroll_settings_id", "type");

-- CreateIndex
CREATE INDEX "payroll_runs_organization_id_status_idx" ON "payroll_runs"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_organization_id_competence_year_competence_mon_key" ON "payroll_runs"("organization_id", "competence_year", "competence_month");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_organization_id_run_number_key" ON "payroll_runs"("organization_id", "run_number");

-- CreateIndex
CREATE INDEX "payroll_run_lines_organization_id_payroll_run_id_idx" ON "payroll_run_lines"("organization_id", "payroll_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_run_lines_payroll_run_id_employee_id_key" ON "payroll_run_lines"("payroll_run_id", "employee_id");

-- CreateIndex
CREATE INDEX "vacations_organization_id_employee_id_idx" ON "vacations"("organization_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "thirteenth_salary_runs_organization_id_year_installment_key" ON "thirteenth_salary_runs"("organization_id", "year", "installment");

-- CreateIndex
CREATE UNIQUE INDEX "thirteenth_salary_runs_organization_id_run_number_key" ON "thirteenth_salary_runs"("organization_id", "run_number");

-- CreateIndex
CREATE UNIQUE INDEX "thirteenth_salary_run_lines_thirteenth_salary_run_id_employ_key" ON "thirteenth_salary_run_lines"("thirteenth_salary_run_id", "employee_id");

-- CreateIndex
CREATE INDEX "terminations_organization_id_employee_id_idx" ON "terminations"("organization_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "terminations_employee_id_key" ON "terminations"("employee_id");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_salary_expense_account_id_fkey" FOREIGN KEY ("salary_expense_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_salary_payable_account_id_fkey" FOREIGN KEY ("salary_payable_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_inss_payable_account_id_fkey" FOREIGN KEY ("inss_payable_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_irrf_payable_account_id_fkey" FOREIGN KEY ("irrf_payable_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_employer_charges_expense_account_id_fkey" FOREIGN KEY ("employer_charges_expense_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_fgts_payable_account_id_fkey" FOREIGN KEY ("fgts_payable_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_employer_inss_payable_account_id_fkey" FOREIGN KEY ("employer_inss_payable_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_benefits_expense_account_id_fkey" FOREIGN KEY ("benefits_expense_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_benefits_payable_account_id_fkey" FOREIGN KEY ("benefits_payable_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_fgts_fine_expense_account_id_fkey" FOREIGN KEY ("fgts_fine_expense_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_fgts_fine_payable_account_id_fkey" FOREIGN KEY ("fgts_fine_payable_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_tax_brackets" ADD CONSTRAINT "payroll_tax_brackets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_tax_brackets" ADD CONSTRAINT "payroll_tax_brackets_payroll_settings_id_fkey" FOREIGN KEY ("payroll_settings_id") REFERENCES "payroll_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacations" ADD CONSTRAINT "vacations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacations" ADD CONSTRAINT "vacations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacations" ADD CONSTRAINT "vacations_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thirteenth_salary_runs" ADD CONSTRAINT "thirteenth_salary_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thirteenth_salary_runs" ADD CONSTRAINT "thirteenth_salary_runs_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thirteenth_salary_run_lines" ADD CONSTRAINT "thirteenth_salary_run_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thirteenth_salary_run_lines" ADD CONSTRAINT "thirteenth_salary_run_lines_thirteenth_salary_run_id_fkey" FOREIGN KEY ("thirteenth_salary_run_id") REFERENCES "thirteenth_salary_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thirteenth_salary_run_lines" ADD CONSTRAINT "thirteenth_salary_run_lines_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminations" ADD CONSTRAINT "terminations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminations" ADD CONSTRAINT "terminations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminations" ADD CONSTRAINT "terminations_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

