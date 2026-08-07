import { BadRequestException, Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { UpdatePayrollSettingsDto } from "./dto/update-payroll-settings.dto";
import { SetTaxBracketsDto } from "./dto/set-tax-brackets.dto";

// Valores de referência para popular a configuração na primeira vez que uma
// organização acessa a tela — NÃO são garantidamente os valores vigentes
// (este sistema não tem acesso à internet para confirmar a tabela do ano
// corrente). A tela de configuração existe justamente para o contador
// conferir/corrigir antes de rodar a primeira folha real.
const DEFAULT_INSS_BRACKETS = [
  { minBase: 0, maxBase: 1412.0, rate: 0.075, deduction: 0 },
  { minBase: 1412.01, maxBase: 2666.68, rate: 0.09, deduction: 21.18 },
  { minBase: 2666.69, maxBase: 4000.03, rate: 0.12, deduction: 101.18 },
  { minBase: 4000.04, maxBase: null, rate: 0.14, deduction: 181.19 },
];
const DEFAULT_IRRF_BRACKETS = [
  { minBase: 0, maxBase: 2259.2, rate: 0, deduction: 0 },
  { minBase: 2259.21, maxBase: 2826.65, rate: 0.075, deduction: 169.44 },
  { minBase: 2826.66, maxBase: 3751.05, rate: 0.15, deduction: 381.44 },
  { minBase: 3751.06, maxBase: 4664.68, rate: 0.225, deduction: 662.77 },
  { minBase: 4664.69, maxBase: null, rate: 0.275, deduction: 896.0 },
];
const DEFAULT_INSS_CEILING = 908.85;
const DEFAULT_IRRF_DEPENDENT_DEDUCTION = 189.59;

@Injectable()
export class PayrollSettingsService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionAdapter>) {}

  private get tx() {
    return this.txHost.tx;
  }

  async getOrCreate(organizationId: string) {
    const existing = await this.tx.payrollSettings.findFirst({
      where: { organizationId },
      include: { taxBrackets: true },
    });
    if (existing) {
      return existing;
    }

    const created = await this.tx.payrollSettings.create({
      data: {
        organizationId,
        irrfDependentDeduction: DEFAULT_IRRF_DEPENDENT_DEDUCTION,
        inssCeiling: DEFAULT_INSS_CEILING,
        fgtsRate: 0.08,
        employerInssRate: 0.268,
        fgtsFineRateWithoutCause: 0.4,
        fgtsFineRateMutualAgreement: 0.2,
        transportVoucherMaxDiscountRate: 0.06,
      },
    });
    // Fora do nested-write de propósito: PayrollTaxBracket tem FK direta
    // tanto para organization quanto para payrollSettings, e o nested-create
    // do Prisma dentro de um `create` de PayrollSettings exigiria repetir a
    // relação `organization` em cada item — createMany direto é mais simples.
    await this.tx.payrollTaxBracket.createMany({
      data: [
        ...DEFAULT_INSS_BRACKETS.map((b) => ({ ...b, type: "INSS" as const })),
        ...DEFAULT_IRRF_BRACKETS.map((b) => ({ ...b, type: "IRRF" as const })),
      ].map((b) => ({ ...b, organizationId, payrollSettingsId: created.id })),
    });

    return this.tx.payrollSettings.findFirstOrThrow({
      where: { id: created.id },
      include: { taxBrackets: true },
    });
  }

  async update(organizationId: string, dto: UpdatePayrollSettingsDto) {
    const settings = await this.getOrCreate(organizationId);

    const accountFields = [
      "salaryExpenseAccountId",
      "salaryPayableAccountId",
      "inssPayableAccountId",
      "irrfPayableAccountId",
      "employerChargesExpenseAccountId",
      "fgtsPayableAccountId",
      "employerInssPayableAccountId",
      "benefitsExpenseAccountId",
      "benefitsPayableAccountId",
      "fgtsFineExpenseAccountId",
      "fgtsFinePayableAccountId",
    ] as const;
    for (const field of accountFields) {
      const accountId = dto[field];
      if (accountId) {
        await this.ensureAccountUsable(organizationId, accountId);
      }
    }

    await this.tx.payrollSettings.update({ where: { id: settings.id }, data: dto });
    return this.getOrCreate(organizationId);
  }

  async setTaxBrackets(organizationId: string, dto: SetTaxBracketsDto) {
    const settings = await this.getOrCreate(organizationId);

    this.validateBracketContinuity(dto.brackets);

    await this.tx.payrollTaxBracket.deleteMany({
      where: { organizationId, payrollSettingsId: settings.id, type: dto.type },
    });
    await this.tx.payrollTaxBracket.createMany({
      data: dto.brackets.map((b) => ({
        organizationId,
        payrollSettingsId: settings.id,
        type: dto.type,
        minBase: b.minBase,
        maxBase: b.maxBase,
        rate: b.rate,
        deduction: b.deduction,
      })),
    });
    return this.getOrCreate(organizationId);
  }

  private validateBracketContinuity(brackets: SetTaxBracketsDto["brackets"]): void {
    const sorted = [...brackets].sort((a, b) => a.minBase - b.minBase);
    const openEnded = sorted.filter((b) => b.maxBase === undefined || b.maxBase === null);
    if (openEnded.length !== 1 || sorted[sorted.length - 1] !== openEnded[0]) {
      throw new BadRequestException("Exatamente a última faixa deve ficar sem teto (maxBase em branco).");
    }
  }

  private async ensureAccountUsable(organizationId: string, accountId: string): Promise<void> {
    const account = await this.tx.account.findFirst({ where: { id: accountId, organizationId } });
    if (!account) {
      throw new BadRequestException("Conta contábil inválida para esta organização.");
    }
    if (!account.isAnalytic || !account.isActive) {
      throw new BadRequestException("Conta contábil precisa ser analítica e estar ativa.");
    }
  }
}
