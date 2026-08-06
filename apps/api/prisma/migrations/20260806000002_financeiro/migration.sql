-- CreateEnum
CREATE TYPE "CounterpartyType" AS ENUM ('SUPPLIER', 'CUSTOMER', 'BOTH');

-- CreateEnum
CREATE TYPE "BankAccountKind" AS ENUM ('BANK', 'CASH');

-- CreateEnum
CREATE TYPE "TitleStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'CANCELED');

-- CreateTable
CREATE TABLE "counterparties" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "CounterpartyType" NOT NULL,
    "tax_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "counterparties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "BankAccountKind" NOT NULL,
    "name" TEXT NOT NULL,
    "bank_code" TEXT,
    "agency" TEXT,
    "account_number" TEXT,
    "gl_account_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_payable" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_number" BIGINT NOT NULL,
    "counterparty_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "competence_date" DATE NOT NULL,
    "original_amount" DECIMAL(18,2) NOT NULL,
    "paid_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "expense_account_id" TEXT NOT NULL,
    "liability_account_id" TEXT NOT NULL,
    "cost_center_id" TEXT,
    "status" "TitleStatus" NOT NULL DEFAULT 'OPEN',
    "accrual_journal_entry_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_payable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_payable_payments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "accounts_payable_id" TEXT NOT NULL,
    "payment_date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_payable_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_receivable" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_number" BIGINT NOT NULL,
    "counterparty_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "competence_date" DATE NOT NULL,
    "original_amount" DECIMAL(18,2) NOT NULL,
    "received_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "asset_account_id" TEXT NOT NULL,
    "revenue_account_id" TEXT NOT NULL,
    "cost_center_id" TEXT,
    "status" "TitleStatus" NOT NULL DEFAULT 'OPEN',
    "accrual_journal_entry_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_receivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_receivable_receipts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "accounts_receivable_id" TEXT NOT NULL,
    "receipt_date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_receivable_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "counterparties_organization_id_idx" ON "counterparties"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "counterparties_organization_id_tax_id_key" ON "counterparties"("organization_id", "tax_id");

-- CreateIndex
CREATE INDEX "bank_accounts_organization_id_idx" ON "bank_accounts"("organization_id");

-- CreateIndex
CREATE INDEX "accounts_payable_organization_id_status_due_date_idx" ON "accounts_payable"("organization_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "accounts_payable_organization_id_counterparty_id_idx" ON "accounts_payable"("organization_id", "counterparty_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_payable_organization_id_document_number_key" ON "accounts_payable"("organization_id", "document_number");

-- CreateIndex
CREATE INDEX "accounts_payable_payments_organization_id_idx" ON "accounts_payable_payments"("organization_id");

-- CreateIndex
CREATE INDEX "accounts_payable_payments_accounts_payable_id_idx" ON "accounts_payable_payments"("accounts_payable_id");

-- CreateIndex
CREATE INDEX "accounts_receivable_organization_id_status_due_date_idx" ON "accounts_receivable"("organization_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "accounts_receivable_organization_id_counterparty_id_idx" ON "accounts_receivable"("organization_id", "counterparty_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_receivable_organization_id_document_number_key" ON "accounts_receivable"("organization_id", "document_number");

-- CreateIndex
CREATE INDEX "accounts_receivable_receipts_organization_id_idx" ON "accounts_receivable_receipts"("organization_id");

-- CreateIndex
CREATE INDEX "accounts_receivable_receipts_accounts_receivable_id_idx" ON "accounts_receivable_receipts"("accounts_receivable_id");

-- AddForeignKey
ALTER TABLE "counterparties" ADD CONSTRAINT "counterparties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_counterparty_id_fkey" FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_expense_account_id_fkey" FOREIGN KEY ("expense_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_liability_account_id_fkey" FOREIGN KEY ("liability_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_accrual_journal_entry_id_fkey" FOREIGN KEY ("accrual_journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_payments" ADD CONSTRAINT "accounts_payable_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_payments" ADD CONSTRAINT "accounts_payable_payments_accounts_payable_id_fkey" FOREIGN KEY ("accounts_payable_id") REFERENCES "accounts_payable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_payments" ADD CONSTRAINT "accounts_payable_payments_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_payments" ADD CONSTRAINT "accounts_payable_payments_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_counterparty_id_fkey" FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_asset_account_id_fkey" FOREIGN KEY ("asset_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_revenue_account_id_fkey" FOREIGN KEY ("revenue_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_accrual_journal_entry_id_fkey" FOREIGN KEY ("accrual_journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_receivable_receipts" ADD CONSTRAINT "accounts_receivable_receipts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_receivable_receipts" ADD CONSTRAINT "accounts_receivable_receipts_accounts_receivable_id_fkey" FOREIGN KEY ("accounts_receivable_id") REFERENCES "accounts_receivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_receivable_receipts" ADD CONSTRAINT "accounts_receivable_receipts_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_receivable_receipts" ADD CONSTRAINT "accounts_receivable_receipts_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

