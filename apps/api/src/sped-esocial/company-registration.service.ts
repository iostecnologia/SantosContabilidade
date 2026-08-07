import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { UpdateCompanyRegistrationDto } from "./dto/update-company-registration.dto";

/**
 * Singleton por organização (get-or-create), mesmo padrão de
 * PayrollSettingsService/FiscalTaxSettingsService — mas sem nenhum valor
 * padrão pré-preenchido: diferente de alíquotas de INSS/IRRF (que têm uma
 * tabela pública de referência), dados cadastrais (CNAE, IE, endereço) são
 * únicos de cada empresa e não têm "valor plausível" para sugerir.
 */
@Injectable()
export class CompanyRegistrationService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionAdapter>) {}

  private get tx() {
    return this.txHost.tx;
  }

  async getOrCreate(organizationId: string) {
    const existing = await this.tx.companyRegistration.findFirst({ where: { organizationId } });
    if (existing) {
      return existing;
    }
    return this.tx.companyRegistration.create({ data: { organizationId } });
  }

  async update(organizationId: string, dto: UpdateCompanyRegistrationDto) {
    const registration = await this.getOrCreate(organizationId);
    return this.tx.companyRegistration.update({ where: { id: registration.id }, data: dto });
  }
}
