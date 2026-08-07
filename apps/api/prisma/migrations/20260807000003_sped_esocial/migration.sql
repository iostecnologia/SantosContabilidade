-- CreateEnum
CREATE TYPE "EsocialEventoStatus" AS ENUM ('GERADO', 'ENVIADO');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "sped_reference_code" TEXT;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "address_city" TEXT,
ADD COLUMN     "address_city_ibge_code" TEXT,
ADD COLUMN     "address_complement" TEXT,
ADD COLUMN     "address_neighborhood" TEXT,
ADD COLUMN     "address_number" TEXT,
ADD COLUMN     "address_state" CHAR(2),
ADD COLUMN     "address_street" TEXT,
ADD COLUMN     "address_zip_code" TEXT,
ADD COLUMN     "birth_date" DATE,
ADD COLUMN     "cbo_code" TEXT,
ADD COLUMN     "ctps_number" TEXT,
ADD COLUMN     "ctps_series" TEXT,
ADD COLUMN     "esocial_category_code" INTEGER,
ADD COLUMN     "pis" TEXT,
ADD COLUMN     "sex" CHAR(1);

-- CreateTable
CREATE TABLE "company_registrations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "legal_nature_code" TEXT,
    "cnae_code" TEXT,
    "state_registration" TEXT,
    "municipal_registration" TEXT,
    "esocial_tax_class_code" TEXT,
    "fpas_code" TEXT,
    "rat_code" INTEGER,
    "fap_rate" DECIMAL(6,4),
    "third_parties_code" TEXT,
    "address_street" TEXT,
    "address_number" TEXT,
    "address_complement" TEXT,
    "address_neighborhood" TEXT,
    "address_city" TEXT,
    "address_city_ibge_code" TEXT,
    "address_state" CHAR(2),
    "address_zip_code" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "accountant_name" TEXT,
    "accountant_cpf" TEXT,
    "accountant_crc" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esocial_eventos" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "sequence_number" BIGINT NOT NULL,
    "event_type" TEXT NOT NULL,
    "employee_id" TEXT,
    "reference_module" TEXT,
    "reference_id" TEXT,
    "competence_date" DATE,
    "xml_content" TEXT NOT NULL,
    "status" "EsocialEventoStatus" NOT NULL DEFAULT 'GERADO',
    "submission_protocol" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "esocial_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_registrations_organization_id_key" ON "company_registrations"("organization_id");

-- CreateIndex
CREATE INDEX "esocial_eventos_organization_id_event_type_idx" ON "esocial_eventos"("organization_id", "event_type");

-- CreateIndex
CREATE INDEX "esocial_eventos_organization_id_employee_id_idx" ON "esocial_eventos"("organization_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "esocial_eventos_organization_id_sequence_number_key" ON "esocial_eventos"("organization_id", "sequence_number");

-- AddForeignKey
ALTER TABLE "company_registrations" ADD CONSTRAINT "company_registrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esocial_eventos" ADD CONSTRAINT "esocial_eventos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esocial_eventos" ADD CONSTRAINT "esocial_eventos_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

