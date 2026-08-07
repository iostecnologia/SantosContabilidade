import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { JournalEntriesService } from "../journal-entries/journal-entries.service";
import { PayrollSettingsService } from "./payroll-settings.service";
import { CreateTerminationDto } from "./dto/create-termination.dto";
import {
  calculateNoticeDays,
  calculateProgressiveTax,
  countWorkedMonthsInYear,
  daysWorkedInMonth,
  dailyRate,
  monthsInCurrentVacationCycle,
  toTaxBracketInputs,
} from "./payroll-calculation.util";

/**
 * Rescisão: uma por funcionário (não é possível desligar duas vezes — ver
 * @@unique([employeeId]) no schema). Verbas devidas variam por `type` (ver
 * cada bloco abaixo). Simplificações assumidas: aviso prévio sempre
 * indenizado; férias vencidas (período aquisitivo já completo) não são
 * reconstruídas automaticamente, ficam a cargo do valor informado em
 * `vestedVacationAmount` na criação; multa de FGTS calculada sobre a soma
 * do FGTS que ESTE sistema já postou para o funcionário (folha + férias +
 * 13º), não sobre o saldo real da conta FGTS na Caixa (que este sistema não
 * tem acesso).
 */
@Injectable()
export class TerminationService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionAdapter>,
    private readonly journalEntries: JournalEntriesService,
    private readonly payrollSettings: PayrollSettingsService,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  list(organizationId: string) {
    return this.tx.termination.findMany({
      where: { organizationId },
      include: { employee: true },
      orderBy: { terminationDate: "desc" },
    });
  }

  async findOneOrThrow(organizationId: string, id: string) {
    const termination = await this.tx.termination.findFirst({
      where: { id, organizationId },
      include: { employee: true },
    });
    if (!termination) {
      throw new NotFoundException("Rescisão não encontrada.");
    }
    return termination;
  }

  async create(organizationId: string, userId: string, dto: CreateTerminationDto) {
    const employee = await this.tx.employee.findFirst({ where: { id: dto.employeeId, organizationId } });
    if (!employee) {
      throw new BadRequestException("Funcionário inválido para esta organização.");
    }
    if (employee.status === "TERMINATED") {
      throw new ConflictException("Funcionário já desligado.");
    }

    const termination = await this.tx.termination.create({
      data: {
        organizationId,
        employeeId: dto.employeeId,
        terminationDate: new Date(dto.terminationDate),
        type: dto.type,
        vestedVacationAmount: dto.vestedVacationAmount ?? 0,
        createdBy: userId,
      },
    });
    return this.findOneOrThrow(organizationId, termination.id);
  }

  async calculate(organizationId: string, id: string) {
    const termination = await this.assertNotPosted(organizationId, id);
    const settings = await this.payrollSettings.getOrCreate(organizationId);
    const inssBrackets = toTaxBracketInputs(settings.taxBrackets.filter((b) => b.type === "INSS"));
    const irrfBrackets = toTaxBracketInputs(settings.taxBrackets.filter((b) => b.type === "IRRF"));

    const employee = termination.employee;
    const baseSalary = Number(employee.baseSalary);
    const daily = dailyRate(baseSalary);
    const admissionDate = employee.admissionDate;
    const terminationDate = termination.terminationDate;

    const balanceSalaryAmount = daily * daysWorkedInMonth(terminationDate);

    const monthsWorkedThisYear = countWorkedMonthsInYear(admissionDate, terminationDate.getUTCFullYear(), terminationDate);
    // Simplificação assumida: 13º proporcional pago em todos os tipos de
    // desligamento, inclusive justa causa (prática mais comum hoje em dia).
    const proportionalThirteenthAmount = baseSalary * (monthsWorkedThisYear / 12);

    // Férias proporcionais NÃO são devidas em justa causa (CLT art. 146).
    const isVacationDue = termination.type !== "WITH_CAUSE";
    const vacationCycleMonths = isVacationDue ? monthsInCurrentVacationCycle(admissionDate, terminationDate) : 0;
    const proportionalVacationAmount = baseSalary * (vacationCycleMonths / 12);
    const vacationConstitutionalBonus = proportionalVacationAmount / 3;
    const vestedVacationAmount = Number(termination.vestedVacationAmount ?? 0);

    let noticeDays = 0;
    let noticeIndemnityAmount = 0;
    if (termination.type === "WITHOUT_CAUSE") {
      noticeDays = calculateNoticeDays(admissionDate, terminationDate);
      noticeIndemnityAmount = daily * noticeDays;
    } else if (termination.type === "MUTUAL_AGREEMENT") {
      noticeDays = calculateNoticeDays(admissionDate, terminationDate);
      noticeIndemnityAmount = daily * noticeDays * 0.5;
    }

    let fgtsFineAmount = 0;
    if (termination.type === "WITHOUT_CAUSE" || termination.type === "MUTUAL_AGREEMENT") {
      const fgtsBase = await this.sumFgtsDeposited(organizationId, employee.id);
      const fineRate =
        termination.type === "WITHOUT_CAUSE"
          ? Number(settings.fgtsFineRateWithoutCause)
          : Number(settings.fgtsFineRateMutualAgreement);
      fgtsFineAmount = fgtsBase * fineRate;
    }

    // Aviso prévio indenizado e verbas de férias são indenizatórias — isentas
    // de INSS/IRRF. Saldo de salário e 13º proporcional são tributáveis, cada
    // um com sua própria base progressiva (naturezas diferentes não se somam
    // antes do cálculo, mesma regra usada nas rescisões de verdade).
    const inssOnSalary = Math.min(calculateProgressiveTax(balanceSalaryAmount, inssBrackets), Number(settings.inssCeiling));
    const irrfOnSalary = calculateProgressiveTax(
      balanceSalaryAmount - inssOnSalary - employee.dependentsCount * Number(settings.irrfDependentDeduction),
      irrfBrackets,
    );
    const inssOnThirteenth = Math.min(
      calculateProgressiveTax(proportionalThirteenthAmount, inssBrackets),
      Number(settings.inssCeiling),
    );
    const irrfOnThirteenth = calculateProgressiveTax(
      proportionalThirteenthAmount - inssOnThirteenth - employee.dependentsCount * Number(settings.irrfDependentDeduction),
      irrfBrackets,
    );
    const inssAmount = inssOnSalary + inssOnThirteenth;
    const irrfAmount = irrfOnSalary + irrfOnThirteenth;

    const netPay =
      balanceSalaryAmount +
      noticeIndemnityAmount +
      proportionalThirteenthAmount +
      vestedVacationAmount +
      proportionalVacationAmount +
      vacationConstitutionalBonus -
      inssAmount -
      irrfAmount;

    await this.tx.termination.update({
      where: { id },
      data: {
        noticeDays,
        balanceSalaryAmount,
        noticeIndemnityAmount,
        proportionalThirteenthAmount,
        proportionalVacationAmount,
        vacationConstitutionalBonus,
        fgtsFineAmount,
        inssAmount,
        irrfAmount,
        netPay,
        status: "CALCULATED",
      },
    });
    return this.findOneOrThrow(organizationId, id);
  }

  async post(organizationId: string, userId: string, id: string) {
    const termination = await this.findOneOrThrow(organizationId, id);
    if (termination.status !== "CALCULATED") {
      throw new ConflictException("A rescisão precisa estar calculada antes de ser postada.");
    }
    const settings = await this.payrollSettings.getOrCreate(organizationId);

    const require = (accountId: string | null, label: string): string => {
      if (!accountId) {
        throw new BadRequestException(`Configure a conta contábil "${label}" em Configurações de Folha antes de postar.`);
      }
      return accountId;
    };

    const grossVerbas =
      Number(termination.balanceSalaryAmount) +
      Number(termination.noticeIndemnityAmount) +
      Number(termination.proportionalThirteenthAmount) +
      Number(termination.vestedVacationAmount) +
      Number(termination.proportionalVacationAmount) +
      Number(termination.vacationConstitutionalBonus);
    const inssAmount = Number(termination.inssAmount);
    const irrfAmount = Number(termination.irrfAmount);
    const fgtsFineAmount = Number(termination.fgtsFineAmount);

    const lines = [
      { accountId: require(settings.salaryExpenseAccountId, "Despesa com salários"), direction: "DEBIT" as const, amount: grossVerbas },
      { accountId: require(settings.salaryPayableAccountId, "Salários a pagar"), direction: "CREDIT" as const, amount: Number(termination.netPay) },
    ];
    if (inssAmount > 0) {
      lines.push({ accountId: require(settings.inssPayableAccountId, "INSS a recolher"), direction: "CREDIT" as const, amount: inssAmount });
    }
    if (irrfAmount > 0) {
      lines.push({ accountId: require(settings.irrfPayableAccountId, "IRRF a recolher"), direction: "CREDIT" as const, amount: irrfAmount });
    }
    if (fgtsFineAmount > 0) {
      lines.push({
        accountId: require(settings.fgtsFineExpenseAccountId, "Despesa com multa de FGTS"),
        direction: "DEBIT" as const,
        amount: fgtsFineAmount,
      });
      lines.push({
        accountId: require(settings.fgtsFinePayableAccountId, "Multa de FGTS a pagar"),
        direction: "CREDIT" as const,
        amount: fgtsFineAmount,
      });
    }

    const entry = await this.journalEntries.create(organizationId, userId, {
      entryDate: termination.terminationDate.toISOString().slice(0, 10),
      competenceDate: termination.terminationDate.toISOString().slice(0, 10),
      description: `Rescisão — ${termination.employee.fullName} (${TERMINATION_TYPE_LABELS[termination.type]})`,
      referenceModule: "PAYROLL_TERMINATION",
      referenceId: termination.id,
      lines,
    });

    await this.tx.termination.update({
      where: { id },
      data: { status: "POSTED", journalEntryId: entry.id, postedAt: new Date() },
    });
    await this.tx.employee.update({
      where: { id: termination.employeeId },
      data: { status: "TERMINATED", terminationDate: termination.terminationDate },
    });
    return this.findOneOrThrow(organizationId, id);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    await this.assertNotPosted(organizationId, id);
    await this.tx.termination.delete({ where: { id } });
  }

  private async sumFgtsDeposited(organizationId: string, employeeId: string): Promise<number> {
    const [payroll, vacation, thirteenth] = await Promise.all([
      this.tx.payrollRunLine.aggregate({
        where: { organizationId, employeeId, payrollRun: { status: "POSTED" } },
        _sum: { fgtsAmount: true },
      }),
      this.tx.vacation.aggregate({
        where: { organizationId, employeeId, status: "POSTED" },
        _sum: { fgtsAmount: true },
      }),
      this.tx.thirteenthSalaryRunLine.aggregate({
        where: { organizationId, employeeId, thirteenthSalaryRun: { status: "POSTED" } },
        _sum: { fgtsAmount: true },
      }),
    ]);
    return (
      Number(payroll._sum.fgtsAmount ?? 0) + Number(vacation._sum.fgtsAmount ?? 0) + Number(thirteenth._sum.fgtsAmount ?? 0)
    );
  }

  private async assertNotPosted(organizationId: string, id: string) {
    const termination = await this.findOneOrThrow(organizationId, id);
    if (termination.status === "POSTED") {
      throw new ConflictException("Esta rescisão já foi postada e não pode mais ser alterada.");
    }
    return termination;
  }
}

const TERMINATION_TYPE_LABELS: Record<string, string> = {
  WITHOUT_CAUSE: "sem justa causa",
  RESIGNATION: "pedido de demissão",
  WITH_CAUSE: "justa causa",
  MUTUAL_AGREEMENT: "acordo mútuo",
};
