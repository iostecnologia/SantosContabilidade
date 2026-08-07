-- CreateEnum
CREATE TYPE "RegimeTributario" AS ENUM ('SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL');

-- CreateEnum
CREATE TYPE "AnexoSimplesNacional" AS ENUM ('I', 'II', 'III', 'IV', 'V');

-- CreateEnum
CREATE TYPE "PisCofinsRegime" AS ENUM ('CUMULATIVO', 'NAO_CUMULATIVO');

-- CreateTable
CREATE TABLE "fiscal_tax_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "regime_tributario" "RegimeTributario" NOT NULL,
    "anexo_simples_nacional" "AnexoSimplesNacional",
    "receita_bruta_12_meses" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pis_cofins_regime" "PisCofinsRegime",
    "pis_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "cofins_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "iss_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "icms_default_internal_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "receita_vendas_account_id" TEXT,
    "receita_servicos_account_id" TEXT,
    "deducoes_tributarias_vendas_account_id" TEXT,
    "deducoes_tributarias_servicos_account_id" TEXT,
    "clientes_a_receber_account_id" TEXT,
    "icms_payable_account_id" TEXT,
    "pis_payable_account_id" TEXT,
    "cofins_payable_account_id" TEXT,
    "iss_payable_account_id" TEXT,
    "simples_nacional_payable_account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_tax_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simples_nacional_brackets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "fiscal_tax_settings_id" TEXT NOT NULL,
    "anexo" "AnexoSimplesNacional" NOT NULL,
    "rbt12_min" DECIMAL(18,2) NOT NULL,
    "rbt12_max" DECIMAL(18,2),
    "aliquota_nominal" DECIMAL(5,4) NOT NULL,
    "parcela_deduzir" DECIMAL(18,2) NOT NULL,
    "percentual_irpj" DECIMAL(5,4) NOT NULL,
    "percentual_csll" DECIMAL(5,4) NOT NULL,
    "percentual_cofins" DECIMAL(5,4) NOT NULL,
    "percentual_pis" DECIMAL(5,4) NOT NULL,
    "percentual_cpp" DECIMAL(5,4) NOT NULL,
    "percentual_icms_ou_iss" DECIMAL(5,4) NOT NULL,

    CONSTRAINT "simples_nacional_brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "icms_uf_rates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "fiscal_tax_settings_id" TEXT NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "internal_rate" DECIMAL(5,4) NOT NULL,

    CONSTRAINT "icms_uf_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_documentos_emitidos" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "natureza_operacao" TEXT NOT NULL,
    "numero_documento" TEXT NOT NULL,
    "data_emissao" DATE NOT NULL,
    "data_competencia" DATE NOT NULL,
    "contraparte_id" TEXT NOT NULL,
    "valor_total" DECIMAL(18,2) NOT NULL,
    "documento_json" JSONB NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_documentos_emitidos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_tax_settings_organization_id_key" ON "fiscal_tax_settings"("organization_id");

-- CreateIndex
CREATE INDEX "simples_nacional_brackets_organization_id_fiscal_tax_settin_idx" ON "simples_nacional_brackets"("organization_id", "fiscal_tax_settings_id", "anexo");

-- CreateIndex
CREATE UNIQUE INDEX "icms_uf_rates_fiscal_tax_settings_id_uf_key" ON "icms_uf_rates"("fiscal_tax_settings_id", "uf");

-- CreateIndex
CREATE INDEX "fiscal_documentos_emitidos_organization_id_data_emissao_idx" ON "fiscal_documentos_emitidos"("organization_id", "data_emissao");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_documentos_emitidos_organization_id_numero_documento_key" ON "fiscal_documentos_emitidos"("organization_id", "numero_documento");

-- AddForeignKey
ALTER TABLE "fiscal_tax_settings" ADD CONSTRAINT "fiscal_tax_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_tax_settings" ADD CONSTRAINT "fiscal_tax_settings_receita_vendas_account_id_fkey" FOREIGN KEY ("receita_vendas_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_tax_settings" ADD CONSTRAINT "fiscal_tax_settings_receita_servicos_account_id_fkey" FOREIGN KEY ("receita_servicos_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_tax_settings" ADD CONSTRAINT "fiscal_tax_settings_deducoes_tributarias_vendas_account_id_fkey" FOREIGN KEY ("deducoes_tributarias_vendas_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_tax_settings" ADD CONSTRAINT "fiscal_tax_settings_deducoes_tributarias_servicos_account__fkey" FOREIGN KEY ("deducoes_tributarias_servicos_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_tax_settings" ADD CONSTRAINT "fiscal_tax_settings_clientes_a_receber_account_id_fkey" FOREIGN KEY ("clientes_a_receber_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_tax_settings" ADD CONSTRAINT "fiscal_tax_settings_icms_payable_account_id_fkey" FOREIGN KEY ("icms_payable_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_tax_settings" ADD CONSTRAINT "fiscal_tax_settings_pis_payable_account_id_fkey" FOREIGN KEY ("pis_payable_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_tax_settings" ADD CONSTRAINT "fiscal_tax_settings_cofins_payable_account_id_fkey" FOREIGN KEY ("cofins_payable_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_tax_settings" ADD CONSTRAINT "fiscal_tax_settings_iss_payable_account_id_fkey" FOREIGN KEY ("iss_payable_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_tax_settings" ADD CONSTRAINT "fiscal_tax_settings_simples_nacional_payable_account_id_fkey" FOREIGN KEY ("simples_nacional_payable_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simples_nacional_brackets" ADD CONSTRAINT "simples_nacional_brackets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simples_nacional_brackets" ADD CONSTRAINT "simples_nacional_brackets_fiscal_tax_settings_id_fkey" FOREIGN KEY ("fiscal_tax_settings_id") REFERENCES "fiscal_tax_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "icms_uf_rates" ADD CONSTRAINT "icms_uf_rates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "icms_uf_rates" ADD CONSTRAINT "icms_uf_rates_fiscal_tax_settings_id_fkey" FOREIGN KEY ("fiscal_tax_settings_id") REFERENCES "fiscal_tax_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_documentos_emitidos" ADD CONSTRAINT "fiscal_documentos_emitidos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_documentos_emitidos" ADD CONSTRAINT "fiscal_documentos_emitidos_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

