import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { JournalEntriesService } from "../journal-entries/journal-entries.service";
import { PayrollSettingsService } from "./payroll-settings.service";
import { CreateVacationDto } from "./dto/create-vacation.dto";
import { calculateProgressiveTax, dailyRate, toTaxBracketInputs } from "./payroll-calculation.util";

/**
 * Um evento por período de férias gozado. Reaproveita as mesmas contas de
 * Configurações de Folha (salário/INSS/IRRF/encargos) usadas na folha
 * mensal — não tem contas próprias, já que "remuneração de férias" é, na
 * prática contábil, tratada como mais uma variação de despesa com pessoal.
 * Regime de caixa: contabiliza no pagamento, sem provisão mensal ao longo
 * do período aquisitivo (ver comentário de topo do schema.prisma).
 */
@Injectable()
export class VacationService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionAdapter>,
    private readonly journalEntries: JournalEntriesService,
    private readonly payrollSettings: PayrollSettingsService,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  list(organizationId: string) {
    return this.tx.vacation.findMany({
      where: { organizationId },
      include: { employee: true },
      orderBy: { startDate: "desc" },
    });
  }

  async findOneOrThrow(organizationId: string, id: string) {
    const vacation = await this.tx.vacation.findFirst({
      where: { id, organizationId },
      include: { employee: true },
    });
    if (!vacation) {
      throw new NotFoundException("Férias não encontradas.");
    }
    return vacation;
  }

  async create(organizationId: string, userId: string, dto: CreateVacationDto) {
    if (dto.daysTaken + dto.daysSold > 30) {
      throw new BadRequestException("Dias gozados + dias vendidos (abono) não pode passar de 30.");
    }
    const employee = await this.tx.employee.findFirst({ where: { id: dto.employeeId, organizationId } });
    if (!employee) {
      throw new BadRequestException("Funcionário inválido para esta organização.");
    }
    if (employee.status === "TERMINATED") {
      throw new BadRequestException("Funcionário já desligado.");
    }

    const vacation = await this.tx.vacation.create({
      data: {
        organizationId,
        employeeId: dto.employeeId,
        acquisitionPeriodStart: new Date(dto.acquisitionPeriodStart),
        acquisitionPeriodEnd: new Date(dto.acquisitionPeriodEnd),
        startDate: new Date(dto.startDate),
        daysTaken: dto.daysTaken,
        daysSold: dto.daysSold,
        createdBy: userId,
      },
    });
    return this.findOneOrThrow(organizationId, vacation.id);
  }

  async calculate(organizationId: string, id: string) {
    const vacation = await this.assertNotPosted(organizationId, id);
    const settings = await this.payrollSettings.getOrCreate(organizationId);
    const inssBrackets = toTaxBracketInputs(settings.taxBrackets.filter((b) => b.type === "INSS"));
    const irrfBrackets = toTaxBracketInputs(settings.taxBrackets.filter((b) => b.type === "IRRF"));

    const daily = dailyRate(Number(vacation.employee.baseSalary));
    const vacationPay = daily * vacation.daysTaken;
    const constitutionalBonus = vacationPay / 3;
    const sellBonus = daily * vacation.daysSold;
    const sellBonusConstitutionalBonus = sellBonus / 3;

    // Abono pecuniário (venda de férias) é verba indenizatória — isenta de
    // INSS/IRRF. Só a remuneração dos dias efetivamente gozados é tributável.
    const taxableBase = vacationPay + constitutionalBonus;
    const inssAmount = Math.min(calculateProgressiveTax(taxableBase, inssBrackets), Number(settings.inssCeiling));
    const irrfBase = taxableBase - inssAmount - vacation.employee.dependentsCount * Number(settings.irrfDependentDeduction);
    const irrfAmount = calculateProgressiveTax(irrfBase, irrfBrackets);
    const fgtsAmount = taxableBase * Number(settings.fgtsRate);
    const employerInssAmount = taxableBase * Number(settings.employerInssRate);

    const netPay = vacationPay + constitutionalBonus + sellBonus + sellBonusConstitutionalBonus - inssAmount - irrfAmount;

    await this.tx.vacation.update({
      where: { id },
      data: {
        vacationPay,
        constitutionalBonus,
        sellBonus,
        sellBonusConstitutionalBonus,
        inssAmount,
        irrfAmount,
        fgtsAmount,
        employerInssAmount,
        netPay,
        status: "CALCULATED",
      },
    });
    return this.findOneOrThrow(organizationId, id);
  }

  async post(organizationId: string, userId: string, id: string) {
    const vacation = await this.findOneOrThrow(organizationId, id);
    if (vacation.status !== "CALCULATED") {
      throw new ConflictException("As férias precisam estar calculadas antes de serem postadas.");
    }
    const settings = await this.payrollSettings.getOrCreate(organizationId);

    const require = (accountId: string | null, label: string): string => {
      if (!accountId) {
        throw new BadRequestException(`Configure a conta contábil "${label}" em Configurações de Folha antes de postar.`);
      }
      return accountId;
    };

    const grossAmount =
      Number(vacation.vacationPay) +
      Number(vacation.constitutionalBonus) +
      Number(vacation.sellBonus) +
      Number(vacation.sellBonusConstitutionalBonus);
    const inssAmount = Number(vacation.inssAmount);
    const irrfAmount = Number(vacation.irrfAmount);
    const fgtsAmount = Number(vacation.fgtsAmount);
    const employerInssAmount = Number(vacation.employerInssAmount);

    const lines = [
      { accountId: require(settings.salaryExpenseAccountId, "Despesa com salários"), direction: "DEBIT" as const, amount: grossAmount },
      { accountId: require(settings.salaryPayableAccountId, "Salários a pagar"), direction: "CREDIT" as const, amount: Number(vacation.netPay) },
    ];
    if (inssAmount > 0) {
      lines.push({ accountId: require(settings.inssPayableAccountId, "INSS a recolher"), direction: "CREDIT" as const, amount: inssAmount });
    }
    if (irrfAmount > 0) {
      lines.push({ accountId: require(settings.irrfPayableAccountId, "IRRF a recolher"), direction: "CREDIT" as const, amount: irrfAmount });
    }
    const employerCharges = fgtsAmount + employerInssAmount;
    if (employerCharges > 0) {
      lines.push({
        accountId: require(settings.employerChargesExpenseAccountId, "Despesa com encargos patronais"),
        direction: "DEBIT" as const,
        amount: employerCharges,
      });
    }
    if (fgtsAmount > 0) {
      lines.push({ accountId: require(settings.fgtsPayableAccountId, "FGTS a recolher"), direction: "CREDIT" as const, amount: fgtsAmount });
    }
    if (employerInssAmount > 0) {
      lines.push({
        accountId: require(settings.employerInssPayableAccountId, "INSS patronal a recolher"),
        direction: "CREDIT" as const,
        amount: employerInssAmount,
      });
    }

    const entry = await this.journalEntries.create(organizationId, userId, {
      entryDate: vacation.startDate.toISOString().slice(0, 10),
      competenceDate: vacation.startDate.toISOString().slice(0, 10),
      description: `Férias — ${vacation.employee.fullName} (${vacation.daysTaken} dia(s) + ${vacation.daysSold} vendido(s))`,
      referenceModule: "PAYROLL_VACATION",
      referenceId: vacation.id,
      lines,
    });

    await this.tx.vacation.update({
      where: { id },
      data: { status: "POSTED", journalEntryId: entry.id, postedAt: new Date() },
    });
    return this.findOneOrThrow(organizationId, id);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    await this.assertNotPosted(organizationId, id);
    await this.tx.vacation.delete({ where: { id } });
  }

  private async assertNotPosted(organizationId: string, id: string) {
    const vacation = await this.findOneOrThrow(organizationId, id);
    if (vacation.status === "POSTED") {
      throw new ConflictException("Estas férias já foram postadas e não podem mais ser alteradas.");
    }
    return vacation;
  }
}
