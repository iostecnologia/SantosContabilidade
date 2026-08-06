-- CreateEnum
CREATE TYPE "BankReconciliationStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "BankStatementLineStatus" AS ENUM ('PENDING', 'MATCHED', 'ADJUSTED', 'IGNORED');

-- CreateTable
CREATE TABLE "bank_reconciliations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "statement_closing_balance" DECIMAL(18,2) NOT NULL,
    "status" "BankReconciliationStatus" NOT NULL DEFAULT 'OPEN',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statement_lines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "bank_reconciliation_id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "transaction_date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT NOT NULL,
    "fit_id" TEXT,
    "status" "BankStatementLineStatus" NOT NULL DEFAULT 'PENDING',
    "matched_journal_entry_line_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_reconciliations_organization_id_bank_account_id_idx" ON "bank_reconciliations"("organization_id", "bank_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_statement_lines_matched_journal_entry_line_id_key" ON "bank_statement_lines"("matched_journal_entry_line_id");

-- CreateIndex
CREATE INDEX "bank_statement_lines_organization_id_bank_reconciliation_id_idx" ON "bank_statement_lines"("organization_id", "bank_reconciliation_id");

-- CreateIndex
CREATE INDEX "bank_statement_lines_organization_id_bank_account_id_fit_id_idx" ON "bank_statement_lines"("organization_id", "bank_account_id", "fit_id");

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_bank_reconciliation_id_fkey" FOREIGN KEY ("bank_reconciliation_id") REFERENCES "bank_reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_matched_journal_entry_line_id_fkey" FOREIGN KEY ("matched_journal_entry_line_id") REFERENCES "journal_entry_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
